// RunPanel — 运行面板（输入 + 历史列表）
// 支持两种模式：
//   1. 自管理模式：传 apiBase + slug，内部调用 useLinforgeRuns
//   2. 受控模式：传 data（UseLinforgeRunsReturn），由页面层管理状态

import { useEffect, useRef, useCallback } from 'react';
import {
  useLinforgeRuns,
  type UseLinforgeRunsReturn,
  type ReplayStep,
} from './useLinforgeRuns';
import { RunPanelInput } from './RunPanelInput';
import { RunPanelList } from './RunPanelList';

/** Self-managed mode props */
export interface RunPanelSelfManagedProps {
  apiBase: string;
  slug: string;
  data?: never;
  onRunSelect?: (runId: string | null) => void;
  onStepsChange?: (steps: ReplayStep[]) => void;
  onRunStarted?: (runId: string) => void;
  onCollapse?: () => void;
}

/** Controlled mode props */
export interface RunPanelControlledProps {
  data: UseLinforgeRunsReturn;
  apiBase?: never;
  slug?: never;
  onRunSelect?: never;
  onStepsChange?: never;
  onRunStarted?: (runId: string) => void;
  onCollapse?: () => void;
}

export type RunPanelProps = RunPanelSelfManagedProps | RunPanelControlledProps;

/** Pulse dot animation CSS (for RunCard running state) */
const PULSE_DOT_CSS = `
@keyframes linforge-pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
`;

/** Collapse button SVG (PanelLeftClose icon) */
function CollapseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
      <path d="m16 15-3-3 3-3" />
    </svg>
  );
}

// ---- 核心渲染逻辑（共用） ----
function RunPanelCore({
  runsData,
  onRunStarted,
  onCollapse,
}: {
  runsData: UseLinforgeRunsReturn;
  onRunStarted?: (runId: string) => void;
  onCollapse?: () => void;
}) {
  const { runs, selectedRunId, selectRun, hasRunning, loading, triggerRun } =
    runsData;

  // 注入脉冲圆点动画 CSS
  useEffect(() => {
    const styleId = 'linforge-pulse-dot-css';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = PULSE_DOT_CSS;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, []);

  const handleTrigger = useCallback(
    async (instruction: string) => {
      const runId = await triggerRun(instruction);
      onRunStarted?.(runId);
      return runId;
    },
    [triggerRun, onRunStarted],
  );

  if (loading) {
    return (
      <div
        style={{
          width: 280,
          borderRight: '1px solid #e2e8e7',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#8da5a2',
          fontSize: 13,
        }}
      >
        加载中...
      </div>
    );
  }

  return (
    <div
      style={{
        width: 280,
        borderRight: '1px solid #e2e8e7',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        flexShrink: 0,
      }}
    >
      {/* 标题行 + 收起按钮 */}
      {onCollapse && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px 0',
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#0f1d1b',
            }}
          >
            运行
          </span>
          <button
            onClick={onCollapse}
            title="收起面板"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: '#8da5a2',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f1f5f4';
              e.currentTarget.style.color = '#0f1d1b';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#8da5a2';
            }}
          >
            <CollapseIcon />
          </button>
        </div>
      )}
      <RunPanelInput onTrigger={handleTrigger} disabled={hasRunning} />
      <div style={{ borderTop: '1px solid #f1f5f4' }} />
      <RunPanelList
        runs={runs}
        selectedRunId={selectedRunId}
        onSelect={selectRun}
      />
    </div>
  );
}

// ---- 自管理模式包装器（内部调用 hook） ----
function SelfManagedRunPanel({
  apiBase,
  slug,
  onRunSelect,
  onStepsChange,
  onRunStarted,
  onCollapse,
}: RunPanelSelfManagedProps) {
  const runsData = useLinforgeRuns({ apiBase, slug });

  // 同步回调到宿主
  const onRunSelectRef = useRef(onRunSelect);
  onRunSelectRef.current = onRunSelect;
  const onStepsChangeRef = useRef(onStepsChange);
  onStepsChangeRef.current = onStepsChange;

  useEffect(() => {
    onRunSelectRef.current?.(runsData.selectedRunId);
  }, [runsData.selectedRunId]);

  useEffect(() => {
    onStepsChangeRef.current?.(runsData.replaySteps);
  }, [runsData.replaySteps]);

  return (
    <RunPanelCore
      runsData={runsData}
      onRunStarted={onRunStarted}
      onCollapse={onCollapse}
    />
  );
}

// ---- 入口组件：自动选择模式 ----
export function RunPanel(props: RunPanelProps) {
  if ('data' in props && props.data) {
    return (
      <RunPanelCore
        runsData={props.data}
        onRunStarted={props.onRunStarted}
        onCollapse={props.onCollapse}
      />
    );
  }
  return <SelfManagedRunPanel {...(props as RunPanelSelfManagedProps)} />;
}
