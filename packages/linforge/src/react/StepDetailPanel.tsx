// StepDetailPanel — 步骤详情右侧面板
// replay 模式点击节点时展示，420px 宽度

import { useState, useMemo, type ReactNode } from 'react';
import type { StepData } from '../core/types';
import { computeStateDiff, type DiffEntry } from './stateDiff';
import { formatDuration, formatTokens } from './formatUtils';

export interface StepDetailPanelProps {
  /** Selected step data */
  step: StepData;
  /** Close panel */
  onClose: () => void;
  /** Custom output renderer (host business customization) */
  renderStepOutput?: (step: StepData) => ReactNode;
  /** Load snapshots callback (triggered on first snapshot display) */
  onLoadSnapshots?: () => void;
}

// ---- 样式常量 ----
const panelStyle: React.CSSProperties = {
  width: 420,
  height: '100%',
  background: '#fff',
  borderLeft: '1px solid #e2e8e7',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  fontSize: 13,
  color: '#0f1d1b',
};

const headerStyle: React.CSSProperties = {
  padding: '16px 20px',
  borderBottom: '1px solid #f1f5f4',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  flexShrink: 0,
};

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: '#8da5a2',
  fontSize: 18,
  lineHeight: 1,
  padding: '0 2px',
};

const metaStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  marginTop: 6,
  fontSize: 12,
  color: '#8da5a2',
};

const metaPillStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
};

const sectionStyle: React.CSSProperties = {
  padding: '12px 20px',
  borderBottom: '1px solid #f1f5f4',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#8da5a2',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  marginBottom: 10,
};

const bodyStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
};

// ---- 值格式化 ----
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'number') {
    // 大数字用 k 格式化
    if (value >= 1000) return formatTokens(value);
    return String(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return `${value.length} items`;
  if (typeof value === 'object') return `${Object.keys(value).length} keys`;
  return String(value);
}

// ---- 通用 key-value 渲染 ----
function GenericKeyValue({
  data,
  diffEntries,
}: {
  data: Record<string, unknown>;
  diffEntries?: DiffEntry[];
}) {
  const diffMap = useMemo(() => {
    if (!diffEntries) return null;
    const map = new Map<string, DiffEntry>();
    for (const entry of diffEntries) {
      map.set(entry.key, entry);
    }
    return map;
  }, [diffEntries]);

  const keys = Object.keys(data);
  if (keys.length === 0) {
    return (
      <div style={{ color: '#8da5a2', fontSize: 12, fontStyle: 'italic' }}>
        无数据
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {keys.map((key) => {
        const diff = diffMap?.get(key);
        const bgColor =
          diff?.type === 'changed'
            ? '#f0fdfa'
            : diff?.type === 'added'
              ? '#ecfdf5'
              : undefined;
        return (
          <div
            key={key}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              padding: '3px 6px',
              borderRadius: 6,
              background: bgColor,
            }}
          >
            <span
              style={{
                fontSize: 12,
                color: '#4b6563',
                fontFamily: 'monospace',
              }}
            >
              {key}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: diff?.type === 'changed' ? 600 : 400,
                color:
                  diff?.type === 'changed'
                    ? '#0d9488'
                    : diff?.type === 'added'
                      ? '#059669'
                      : '#0f1d1b',
                fontFamily: 'monospace',
                maxWidth: '60%',
                textAlign: 'right' as const,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap' as const,
              }}
            >
              {formatValue(data[key])}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---- 通用 output 渲染 ----
function DefaultOutputRenderer({
  output,
}: {
  output: Record<string, unknown>;
}) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const keys = Object.keys(output);
  if (keys.length === 0) {
    return (
      <div style={{ color: '#8da5a2', fontSize: 12, fontStyle: 'italic' }}>
        无输出
      </div>
    );
  }

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {keys.map((key) => {
        const value = output[key];
        const isExpanded = expandedKeys.has(key);

        // 字符串：截断 3 行 + 展开
        if (typeof value === 'string') {
          const lines = value.split('\n');
          const needsTruncation = lines.length > 3 || value.length > 300;
          const displayText =
            !isExpanded && needsTruncation
              ? lines.slice(0, 3).join('\n').slice(0, 300)
              : value;

          return (
            <div key={key}>
              <div
                style={{
                  fontSize: 11,
                  color: '#8da5a2',
                  fontFamily: 'monospace',
                  marginBottom: 2,
                }}
              >
                {key}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: '#0f1d1b',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap' as const,
                  wordBreak: 'break-word' as const,
                }}
              >
                {displayText}
                {!isExpanded && needsTruncation && '...'}
              </div>
              {needsTruncation && (
                <button
                  type="button"
                  onClick={() => toggleExpand(key)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0d9488',
                    fontSize: 11,
                    cursor: 'pointer',
                    padding: '2px 0',
                  }}
                >
                  {isExpanded ? '收起' : '展开'}
                </button>
              )}
            </div>
          );
        }

        // 数组：显示 count + 可展开
        if (Array.isArray(value)) {
          return (
            <div key={key}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                }}
                onClick={() => toggleExpand(key)}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: '#8da5a2',
                    fontFamily: 'monospace',
                  }}
                >
                  {key}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: '#4b6563',
                    background: '#f1f5f4',
                    padding: '1px 6px',
                    borderRadius: 4,
                  }}
                >
                  {value.length} items
                </span>
                <span style={{ fontSize: 10, color: '#8da5a2' }}>
                  {isExpanded ? '▼' : '▶'}
                </span>
              </div>
              {isExpanded && (
                <pre
                  style={{
                    fontSize: 11,
                    color: '#4b6563',
                    background: '#f8fafa',
                    padding: 8,
                    borderRadius: 6,
                    marginTop: 4,
                    overflow: 'auto',
                    maxHeight: 200,
                    whiteSpace: 'pre-wrap' as const,
                    wordBreak: 'break-word' as const,
                  }}
                >
                  {JSON.stringify(value, null, 2)}
                </pre>
              )}
            </div>
          );
        }

        // 对象：递归 key-value（最多 2 层）
        if (typeof value === 'object' && value !== null) {
          return (
            <div key={key}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                }}
                onClick={() => toggleExpand(key)}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: '#8da5a2',
                    fontFamily: 'monospace',
                  }}
                >
                  {key}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: '#4b6563',
                    background: '#f1f5f4',
                    padding: '1px 6px',
                    borderRadius: 4,
                  }}
                >
                  {Object.keys(value).length} keys
                </span>
                <span style={{ fontSize: 10, color: '#8da5a2' }}>
                  {isExpanded ? '▼' : '▶'}
                </span>
              </div>
              {isExpanded && (
                <div style={{ marginTop: 4, paddingLeft: 12 }}>
                  <GenericKeyValue data={value as Record<string, unknown>} />
                </div>
              )}
            </div>
          );
        }

        // number / boolean / 其他
        return (
          <div
            key={key}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: '#8da5a2',
                fontFamily: 'monospace',
              }}
            >
              {key}
            </span>
            <span style={{ fontSize: 12, fontFamily: 'monospace' }}>
              {formatValue(value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---- StepDetailPanel 主组件 ----

export function StepDetailPanel({
  step,
  onClose,
  renderStepOutput,
  onLoadSnapshots,
}: StepDetailPanelProps) {
  const hasSnapshots = !!step.stateBefore || !!step.stateAfter;

  // 首次渲染时触发快照加载
  useMemo(() => {
    if (!hasSnapshots && onLoadSnapshots) {
      onLoadSnapshots();
    }
  }, [hasSnapshots, onLoadSnapshots]);

  // Diff 计算
  const diffEntries = useMemo(() => {
    if (step.stateBefore && step.stateAfter) {
      return computeStateDiff(step.stateBefore, step.stateAfter);
    }
    return undefined;
  }, [step.stateBefore, step.stateAfter]);

  // State 快照展示数据
  const snapshotData = step.stateAfter ?? step.stateBefore ?? step.input;

  return (
    <div style={panelStyle}>
      {/* 头部 */}
      <div style={headerStyle}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            Step — {step.nodeId} #{step.stepNumber}
          </div>
          <div style={metaStyle}>
            {step.durationMs > 0 && (
              <span style={metaPillStyle}>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {formatDuration(step.durationMs)}
              </span>
            )}
            {step.tokensUsed > 0 && (
              <span style={metaPillStyle}>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="8" cy="8" r="6" />
                  <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
                  <path d="M7 6h1v4" />
                </svg>
                {formatTokens(step.tokensUsed)} tokens
              </span>
            )}
            {step.toolName && (
              <span style={metaPillStyle}>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
                {step.toolName}
              </span>
            )}
          </div>
        </div>
        <button type="button" style={closeBtnStyle} onClick={onClose}>
          ✕
        </button>
      </div>

      {/* 内容区域 */}
      <div style={bodyStyle}>
        {/* Output 区域 */}
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Output</div>
          {renderStepOutput ? (
            renderStepOutput(step)
          ) : (
            <DefaultOutputRenderer output={step.output} />
          )}
        </div>

        {/* State 快照区域 */}
        <div style={{ ...sectionStyle, borderBottom: 'none' }}>
          <div style={sectionTitleStyle}>
            State Snapshot
            {diffEntries && (
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 10,
                  fontWeight: 400,
                  color: '#0d9488',
                  textTransform: 'none' as const,
                  letterSpacing: 0,
                }}
              >
                {diffEntries.filter((d) => d.type !== 'unchanged').length}{' '}
                changed
              </span>
            )}
          </div>
          <GenericKeyValue data={snapshotData} diffEntries={diffEntries} />
        </div>
      </div>
    </div>
  );
}
