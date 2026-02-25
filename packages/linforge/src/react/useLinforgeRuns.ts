// useLinforgeRuns — Run history + replay data hook

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { RunRecord, StepData } from '../core/types';

/** Canvas node replay state */
export interface ReplayStep {
  nodeKey: string;
  status: 'completed' | 'running' | 'failed';
  durationMs?: number;
  tokensUsed?: number;
}

export interface UseLinforgeRunsOptions {
  apiBase: string;
  slug: string;
}

export interface UseLinforgeRunsReturn {
  runs: RunRecord[];
  selectedRunId: string | null;
  selectRun: (id: string | null) => void;
  steps: StepData[];
  replaySteps: ReplayStep[];
  hasRunning: boolean;
  loading: boolean;
  triggerRun: (instruction: string) => Promise<string>;
  /** Currently selected step node key */
  selectedStepNodeKey: string | null;
  /** Select/deselect a step node */
  selectStepNode: (nodeKey: string | null) => void;
  /** Step data for the selected node */
  selectedStepDetail: StepData | null;
  /** Step data with snapshots (loaded on demand) */
  stepSnapshots: StepData[] | null;
  /** Load step data with snapshots */
  loadSnapshots: () => Promise<void>;
}

/** List polling interval (when there are running runs) */
const LIST_POLL_MS = 10_000;
/** Detail + steps polling interval (when selected run is running) */
const DETAIL_POLL_MS = 3_000;

export function useLinforgeRuns({
  apiBase,
  slug,
}: UseLinforgeRunsOptions): UseLinforgeRunsReturn {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStepNodeKey, setSelectedStepNodeKey] = useState<string | null>(
    null,
  );
  const [stepSnapshots, setStepSnapshots] = useState<StepData[] | null>(null);
  // 缓存已加载快照的 runId，避免重复请求
  const snapshotRunId = useRef<string | null>(null);

  // AbortController 引用，防竞态
  const listAbort = useRef<AbortController | null>(null);
  const detailAbort = useRef<AbortController | null>(null);

  // 是否有运行中的 run
  const hasRunning = runs.some((r) => r.status === 'running');

  // 选中的 run
  const selectedRun = runs.find((r) => r.id === selectedRunId) || null;

  // ---- 列表拉取 ----
  const fetchRuns = useCallback(async () => {
    listAbort.current?.abort();
    const ctrl = new AbortController();
    listAbort.current = ctrl;
    try {
      const res = await fetch(`${apiBase}/graph/${slug}/runs?limit=50`, {
        signal: ctrl.signal,
      });
      if (!res.ok) return;
      const data = await res.json();
      setRuns(Array.isArray(data) ? data : (data.runs ?? []));
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return;
    } finally {
      setLoading(false);
    }
  }, [apiBase, slug]);

  // 初始加载 + 轮询
  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  useEffect(() => {
    if (!hasRunning) return;
    const timer = setInterval(fetchRuns, LIST_POLL_MS);
    return () => clearInterval(timer);
  }, [hasRunning, fetchRuns]);

  // ---- 步骤拉取 ----
  const fetchSteps = useCallback(
    async (runId: string) => {
      detailAbort.current?.abort();
      const ctrl = new AbortController();
      detailAbort.current = ctrl;
      try {
        const res = await fetch(`${apiBase}/runs/${runId}/steps`, {
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        setSteps(Array.isArray(data) ? data : (data.steps ?? []));
      } catch (e: unknown) {
        if (e instanceof Error && e.name === 'AbortError') return;
      }
    },
    [apiBase],
  );

  // 选中 run 变化 → 拉步骤
  useEffect(() => {
    if (!selectedRunId) {
      setSteps([]);
      return;
    }
    fetchSteps(selectedRunId);
  }, [selectedRunId, fetchSteps]);

  // 选中 run 为 running 时轮询步骤 + 列表
  useEffect(() => {
    if (!selectedRunId || selectedRun?.status !== 'running') return;
    const timer = setInterval(() => {
      fetchSteps(selectedRunId);
      fetchRuns();
    }, DETAIL_POLL_MS);
    return () => clearInterval(timer);
  }, [selectedRunId, selectedRun?.status, fetchSteps, fetchRuns]);

  // ---- ReplayStep 派生（useMemo 稳定引用） ----
  const runStatus = selectedRun?.status;
  const replaySteps: ReplayStep[] = useMemo(
    () =>
      steps.map((step) => {
        const hasOutput = step.output && Object.keys(step.output).length > 0;
        const hasError = hasOutput && 'error' in step.output;

        let status: ReplayStep['status'];
        if (hasOutput && hasError) {
          status = 'failed';
        } else if (hasOutput && step.durationMs > 0) {
          status = 'completed';
        } else if (runStatus === 'running') {
          status = 'running';
        } else {
          status = 'completed';
        }

        return {
          nodeKey: step.nodeId,
          status,
          durationMs: step.durationMs || undefined,
          tokensUsed: step.tokensUsed || undefined,
        };
      }),
    [steps, runStatus],
  );

  // ---- 选中步骤节点 ----
  const selectStepNode = useCallback((nodeKey: string | null) => {
    setSelectedStepNodeKey(nodeKey);
  }, []);

  // 选中节点对应的步骤详情（优先从 snapshots 读取，fallback 到 steps）
  const selectedStepDetail: StepData | null = useMemo(() => {
    if (!selectedStepNodeKey) return null;
    const source = stepSnapshots ?? steps;
    return source.find((s) => s.nodeId === selectedStepNodeKey) ?? null;
  }, [selectedStepNodeKey, stepSnapshots, steps]);

  // 切换 run 时清理选中节点和快照缓存
  useEffect(() => {
    setSelectedStepNodeKey(null);
    setStepSnapshots(null);
    snapshotRunId.current = null;
  }, [selectedRunId]);

  // ---- 加载带快照的步骤 ----
  const loadSnapshots = useCallback(async () => {
    if (!selectedRunId) return;
    // 已缓存则跳过
    if (snapshotRunId.current === selectedRunId && stepSnapshots !== null)
      return;

    try {
      const res = await fetch(
        `${apiBase}/runs/${selectedRunId}/steps?includeSnapshots=true`,
      );
      if (!res.ok) return;
      const data = await res.json();
      const loaded = Array.isArray(data) ? data : (data.steps ?? []);
      setStepSnapshots(loaded);
      snapshotRunId.current = selectedRunId;
    } catch {
      // 静默失败
    }
  }, [apiBase, selectedRunId, stepSnapshots]);

  // ---- 触发运行 ----
  const triggerRun = useCallback(
    async (instruction: string): Promise<string> => {
      const res = await fetch(`${apiBase}/graph/${slug}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction }),
      });
      if (!res.ok) {
        throw new Error(`触发运行失败: ${res.status}`);
      }
      const data = await res.json();
      const runId = data.runId || data.id;

      // 立即拉取最新列表并选中
      await fetchRuns();
      setSelectedRunId(runId);
      return runId;
    },
    [apiBase, slug, fetchRuns],
  );

  // 选择 run
  const selectRun = useCallback((id: string | null) => {
    setSelectedRunId((prev) => (prev === id ? null : id));
  }, []);

  // 清理
  useEffect(() => {
    return () => {
      listAbort.current?.abort();
      detailAbort.current?.abort();
    };
  }, []);

  return {
    runs,
    selectedRunId,
    selectRun,
    steps,
    replaySteps,
    hasRunning,
    loading,
    triggerRun,
    selectedStepNodeKey,
    selectStepNode,
    selectedStepDetail,
    stepSnapshots,
    loadSnapshots,
  };
}
