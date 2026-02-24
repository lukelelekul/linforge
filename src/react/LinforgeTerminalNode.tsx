// LinforgeTerminalNode — START/END 圆形节点

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ReplayStatus } from './LinforgeNode';

interface TerminalNodeData {
  label: string;
  isStart?: boolean;
  replayStatus?: ReplayStatus;
  [key: string]: unknown;
}

/** Handle inline style — teal solid dot */
const handleStyle: React.CSSProperties = {
  width: 14,
  height: 14,
  background: '#0d9488',
  border: '2px solid #fff',
  boxShadow: '0 0 0 1px #0d9488',
  transition: 'transform 0.15s, box-shadow 0.15s',
};

/** Terminal node replay border colors */
const TERMINAL_REPLAY_BORDER: Record<string, string> = {
  completed: '#10b981',
  running: '#3b82f6',
  failed: '#ef4444',
};

function LinforgeTerminalNodeComponent({ data, selected }: NodeProps) {
  const { label, isStart, replayStatus } = data as unknown as TerminalNodeData;

  const isReplay = !!replayStatus;
  const replayBorder = replayStatus
    ? TERMINAL_REPLAY_BORDER[replayStatus]
    : undefined;

  return (
    <div
      style={{
        width: 56,
        height: 56,
        borderRadius: '50%',
        border: isReplay
          ? `3px solid ${replayBorder || '#d1d5db'}`
          : selected
            ? '3px solid #0d9488'
            : '2.5px solid #2dd4bf',
        boxShadow:
          isReplay && replayStatus === 'completed'
            ? '0 0 8px rgba(16, 185, 129, 0.25)'
            : selected
              ? '0 0 0 3px rgba(153, 246, 228, 0.4)'
              : 'none',
        background: isStart ? '#f0fdfa' : '#f9fafb',
        color: isStart ? '#0f766e' : '#6b7280',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
        fontWeight: 700,
        transition: 'all 0.2s',
        opacity: isReplay && replayStatus === 'idle' ? 0.5 : 1,
      }}
    >
      {/* 全部 type="source"，配合 ConnectionMode.Loose 保证拖拽方向 = 连线方向 */}
      {isStart ? (
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          style={handleStyle}
        />
      ) : (
        <Handle
          type="source"
          position={Position.Left}
          id="left"
          style={handleStyle}
        />
      )}
      {label}
    </div>
  );
}

export const LinforgeTerminalNode = memo(LinforgeTerminalNodeComponent);
