// RunPanelList — 运行历史列表

import type { RunRecord } from '../core/types';
import {
  formatRelativeTime,
  formatTokens,
  formatDuration,
} from './formatUtils';

export interface RunPanelListProps {
  runs: RunRecord[];
  selectedRunId: string | null;
  onSelect: (id: string | null) => void;
}

/** Status badge color scheme */
const STATUS_STYLES: Record<
  string,
  { bg: string; color: string; label: string }
> = {
  running: { bg: '#dbeafe', color: '#2563eb', label: '运行中' },
  completed: { bg: '#d1fae5', color: '#059669', label: '完成' },
  failed: { bg: '#fee2e2', color: '#dc2626', label: '失败' },
  cancelled: { bg: '#f3f4f6', color: '#6b7280', label: '已取消' },
};

export function RunPanelList({
  runs,
  selectedRunId,
  onSelect,
}: RunPanelListProps) {
  return (
    <div
      style={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '8px 16px',
          fontSize: 10,
          fontWeight: 600,
          color: '#8da5a2',
          letterSpacing: '0.1em',
          textTransform: 'uppercase' as const,
        }}
      >
        运行历史
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
        {runs.length === 0 && (
          <div
            style={{
              padding: '24px 8px',
              textAlign: 'center',
              fontSize: 12,
              color: '#8da5a2',
            }}
          >
            暂无运行记录
          </div>
        )}
        {runs.map((run) => {
          const isSelected = run.id === selectedRunId;
          const isRunning = run.status === 'running';
          const statusStyle =
            STATUS_STYLES[run.status] || STATUS_STYLES.cancelled;
          const instruction = (run.input?.instruction as string) || '(无指令)';
          const duration =
            run.finishedAt && run.startedAt
              ? new Date(run.finishedAt).getTime() -
                new Date(run.startedAt).getTime()
              : null;

          return (
            <div
              key={run.id}
              onClick={() => onSelect(run.id)}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                marginBottom: 4,
                cursor: 'pointer',
                background: isSelected
                  ? '#f0fdfa'
                  : isRunning
                    ? '#eff6ff'
                    : 'transparent',
                border: isSelected
                  ? '1px solid #99f6e4'
                  : '1px solid transparent',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = '#f8fafa';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = isRunning
                    ? '#eff6ff'
                    : 'transparent';
                }
              }}
            >
              {/* 行1：指令 + running 脉冲圆点 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: '#1f2937',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  {instruction}
                </div>
                {isRunning && (
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#3b82f6',
                      flexShrink: 0,
                      animation: 'linforge-pulse-dot 2s ease-in-out infinite',
                    }}
                  />
                )}
              </div>

              {/* 行2：状态 badge + 相对时间 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: statusStyle.bg,
                    color: statusStyle.color,
                    fontWeight: 500,
                  }}
                >
                  {statusStyle.label}
                </span>
                <span style={{ fontSize: 11, color: '#8da5a2' }}>
                  {formatRelativeTime(run.startedAt)}
                </span>
              </div>

              {/* 行3（条件）：token + duration */}
              {(run.tokensUsed > 0 || duration) && (
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    marginTop: 4,
                    fontSize: 10,
                    color: '#8da5a2',
                  }}
                >
                  {run.tokensUsed > 0 && (
                    <span>{formatTokens(run.tokensUsed)} tokens</span>
                  )}
                  {duration != null && <span>{formatDuration(duration)}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
