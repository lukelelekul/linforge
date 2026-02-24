// LinforgeNode — 普通节点卡片组件

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { formatDuration, formatTokens } from './formatUtils';
import { getIconById, BUILTIN_COLORS } from './icons';

export type ReplayStatus = 'idle' | 'completed' | 'running' | 'failed';

interface LinforgeNodeData {
  label: string;
  description?: string;
  icon?: string;
  color?: string;
  nodeKey: string;
  nodeType?: string;
  isSkeleton?: boolean;
  edgeHighlight?: boolean;
  replayStatus?: ReplayStatus;
  replayDuration?: number;
  replayTokens?: number;
  [key: string]: unknown;
}

/** Handle common inline style — teal solid dot, clearly visible on white nodes */
const handleStyle: React.CSSProperties = {
  width: 12,
  height: 12,
  background: '#0d9488',
  border: '2px solid #fff',
  boxShadow: '0 0 0 1px #0d9488',
  transition: 'transform 0.15s, box-shadow 0.15s',
};

/** Skeleton node Handle style — gray */
const skeletonHandleStyle: React.CSSProperties = {
  ...handleStyle,
  background: '#9ca3af',
  boxShadow: '0 0 0 1px #9ca3af',
};

/** Visual configuration for replay status */
const REPLAY_STYLES: Record<
  ReplayStatus,
  { border: string; bg: string; shadow: string; opacity?: number }
> = {
  idle: {
    border: '2px solid #e5e7eb',
    bg: '#fff',
    shadow: '0 1px 3px rgba(0,0,0,0.04)',
    opacity: 0.5,
  },
  completed: {
    border: '2px solid #10b981',
    bg: '#ecfdf5',
    shadow: '0 0 8px rgba(16, 185, 129, 0.25)',
  },
  running: {
    border: '2px solid #3b82f6',
    bg: '#eff6ff',
    shadow: '0 0 8px rgba(59, 130, 246, 0.3)',
  },
  failed: {
    border: '2px solid #ef4444',
    bg: '#fef2f2',
    shadow: '0 0 8px rgba(239, 68, 68, 0.25)',
  },
};

function LinforgeNodeComponent({ data, selected }: NodeProps) {
  const {
    label,
    description,
    icon,
    color,
    nodeKey,
    nodeType,
    isSkeleton,
    edgeHighlight,
    replayStatus,
    replayDuration,
    replayTokens,
  } = data as unknown as LinforgeNodeData;

  // edgeHighlight 或 selected 都视为高亮状态
  const highlighted = selected || edgeHighlight;
  const isReplay = !!replayStatus;

  // 节点颜色：从预设查值，fallback 到 teal
  const nodeColor =
    BUILTIN_COLORS.find((c) => c.id === color)?.value ?? '#0d9488';

  // 图标
  const IconFn = icon ? getIconById(icon) : null;

  const currentHandleStyle = isSkeleton
    ? skeletonHandleStyle
    : {
        ...handleStyle,
        background: nodeColor,
        boxShadow: `0 0 0 1px ${nodeColor}`,
      };

  // Replay 模式优先使用 replay 样式
  let borderStyle: string;
  let boxShadow: string;
  let bgColor: string;
  let nodeOpacity: number | undefined;

  // 左侧 accent line 用 inset box-shadow 实现，不影响布局尺寸
  let accentShadow = '';

  if (isReplay) {
    const rs = REPLAY_STYLES[replayStatus];
    borderStyle = rs.border;
    boxShadow = rs.shadow;
    bgColor = rs.bg;
    nodeOpacity = rs.opacity;
  } else {
    // 原有 blueprint 逻辑 — 统一 2px 边框
    borderStyle = isSkeleton
      ? highlighted
        ? '2px dashed #9ca3af'
        : '2px dashed #c5d5d3'
      : highlighted
        ? `2px solid ${nodeColor}`
        : '2px solid rgba(0,0,0,0.08)';

    const outerShadow = isSkeleton
      ? highlighted
        ? '0 0 0 3px rgba(156, 163, 175, 0.3)'
        : '0 1px 3px rgba(0,0,0,0.02)'
      : highlighted
        ? `0 0 0 3px ${nodeColor}1F`
        : '0 1px 3px rgba(0,0,0,0.03), 0 1px 2px rgba(0,0,0,0.02)';

    // bound 节点（非 skeleton）左侧加 accent line（使用节点颜色）
    if (!isSkeleton) {
      accentShadow = `inset 3px 0 0 ${nodeColor}`;
      boxShadow = `${accentShadow}, ${outerShadow}`;
    } else {
      boxShadow = outerShadow;
    }

    bgColor = isSkeleton ? '#fafafa' : '#fff';
  }

  // running 脉冲动画类名
  const animationClass =
    replayStatus === 'running' ? 'linforge-pulse-node' : '';

  return (
    <div
      className={`linforge-node ${animationClass}`}
      style={{
        width: 220,
        minHeight: 106,
        borderRadius: 12,
        border: borderStyle,
        boxShadow,
        background: bgColor,
        padding: '14px 16px',
        transition: 'all 0.2s',
        cursor: isReplay ? 'default' : 'grab',
        opacity: nodeOpacity,
      }}
    >
      {/* 8 方向 Handle，全部 type="source" 保证拖拽方向 = 连线方向 */}
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        style={currentHandleStyle}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left-out"
        style={currentHandleStyle}
      />
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        style={currentHandleStyle}
      />
      <Handle
        type="source"
        position={Position.Top}
        id="top-out"
        style={currentHandleStyle}
      />

      {/* 节点内容 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            minWidth: 0,
          }}
        >
          {/* 图标 */}
          {!isSkeleton && IconFn && (
            <div style={{ flexShrink: 0, color: nodeColor, lineHeight: 0 }}>
              {IconFn({ size: 14, color: nodeColor })}
            </div>
          )}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              minWidth: 0,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: isSkeleton ? '#9ca3af' : '#1f2937',
                lineHeight: 1.4,
              }}
            >
              {label}
            </div>
            {nodeKey && nodeKey !== label && (
              <div
                style={{
                  fontSize: 10,
                  fontFamily: 'ui-monospace, monospace',
                  color: '#8da5a2',
                  lineHeight: 1.2,
                }}
              >
                {nodeKey}
              </div>
            )}
          </div>
        </div>
        {isSkeleton && (
          <span
            style={{
              fontSize: 10,
              color: '#d97706',
              background: '#fef3c7',
              padding: '1px 6px',
              borderRadius: 4,
              whiteSpace: 'nowrap',
              fontWeight: 500,
            }}
          >
            未绑定
          </span>
        )}
        {!isSkeleton && nodeType === 'llm' && (
          <span
            style={{
              fontSize: 10,
              color: '#0d9488',
              background: '#f0fdfa',
              padding: '1px 6px',
              borderRadius: 4,
              whiteSpace: 'nowrap',
              fontWeight: 500,
            }}
          >
            Prompt
          </span>
        )}
      </div>
      {description && (
        <div
          style={{
            marginTop: 4,
            fontSize: 11,
            color: isSkeleton ? '#d1d5db' : '#6b7280',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {description}
        </div>
      )}

      {/* Replay 模式：completed/failed 时显示耗时和 token */}
      {isReplay &&
        (replayStatus === 'completed' || replayStatus === 'failed') &&
        (replayDuration || replayTokens) && (
          <div
            style={{
              marginTop: 6,
              display: 'flex',
              gap: 8,
              fontSize: 10,
              color: '#6b7280',
            }}
          >
            {replayDuration != null && (
              <span>{formatDuration(replayDuration)}</span>
            )}
            {replayTokens != null && (
              <span>{formatTokens(replayTokens)} tokens</span>
            )}
          </div>
        )}

      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={currentHandleStyle}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right-in"
        style={currentHandleStyle}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        style={currentHandleStyle}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom-in"
        style={currentHandleStyle}
      />
    </div>
  );
}

export const LinforgeNode = memo(LinforgeNodeComponent);
