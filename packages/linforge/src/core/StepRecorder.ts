// StepRecorder — 通用步骤记录器
// 通过 StepPersister 接口解耦 DB，宿主应用提供具体实现

import type { OutputSummarizer, StepPersister } from './types';
import { sanitizeState } from './stateSanitizer';

// 运行级步骤计数器（agentRunId → 当前 stepNumber）
const stepCounters = new Map<string, number>();

// 获取并递增步骤编号
function nextStepNumber(runId: string): number {
  const current = stepCounters.get(runId) ?? 0;
  const next = current + 1;
  stepCounters.set(runId, next);
  return next;
}

/** Clear counter (call after run completes) */
export function clearStepCounter(runId: string): void {
  stepCounters.delete(runId);
}

/**
 * Default input summary — extracts basic state information
 * Host applications can override via the inputSummarizer parameter
 */
function defaultInputSummary(
  state: Record<string, unknown>,
): Record<string, unknown> {
  const summary: Record<string, unknown> = {};

  // 提取常见字段
  if ('iteration' in state) summary.iteration = state.iteration;
  if ('tokensUsed' in state) summary.tokensUsed = state.tokensUsed;

  // 提取数组类型字段的 count
  for (const [key, value] of Object.entries(state)) {
    if (Array.isArray(value)) {
      summary[`${key}Count`] = value.length;
    }
  }

  return summary;
}

/**
 * Get output summary
 * Priority: passed-in summarizer > default (raw output)
 */
function getOutputSummary(
  input: Record<string, unknown>,
  output: Record<string, unknown>,
  summarizer?: OutputSummarizer,
): Record<string, unknown> {
  if (summarizer) {
    return summarizer(input, output) as Record<string, unknown>;
  }
  return output;
}

/** Extract token usage delta from node result */
function extractTokensDelta(
  state: Record<string, unknown>,
  result: Record<string, unknown>,
): number {
  if (
    'tokensUsed' in result &&
    typeof result.tokensUsed === 'number' &&
    'tokensUsed' in state &&
    typeof state.tokensUsed === 'number'
  ) {
    return result.tokensUsed - state.tokensUsed;
  }
  return 0;
}

export interface StepRecordingOptions {
  /** DB persistence adapter */
  persister: StepPersister;
  /** Key to extract runId from state, defaults to "agentRunId" */
  runIdKey?: string;
  /** Custom input summarizer function */
  inputSummarizer?: (state: Record<string, unknown>) => Record<string, unknown>;
  /** Custom output summarizer function (priority: this param > globally registered > default) */
  outputSummarizer?: OutputSummarizer;
  /** Enable debug: record full state snapshots (stateBefore / stateAfter) */
  debug?: boolean;
}

type NodeFn<S = any> = (state: S) => Partial<S> | Promise<Partial<S>>;

/**
 * Wrap a node function with automatic AgentStep recording
 * Writes to DB via StepPersister interface, fire-and-forget to avoid blocking graph execution
 */
export function withStepRecording<S extends Record<string, unknown>>(
  nodeId: string,
  nodeFn: NodeFn<S>,
  options: StepRecordingOptions,
): NodeFn<S> {
  const {
    persister,
    runIdKey = 'agentRunId',
    inputSummarizer,
    outputSummarizer,
    debug = false,
  } = options;

  return async (state: S): Promise<Partial<S>> => {
    const runId = state[runIdKey];

    // 无 runId 时跳过记录（本地测试场景）
    if (!runId || typeof runId !== 'string') {
      return nodeFn(state);
    }

    const stepNumber = nextStepNumber(runId);
    const startTime = Date.now();
    const inputSummary = inputSummarizer
      ? inputSummarizer(state)
      : defaultInputSummary(state);

    // debug 模式：记录执行前快照
    const stateBefore = debug ? sanitizeState(state) : undefined;

    try {
      const result = await nodeFn(state);
      const durationMs = Date.now() - startTime;
      const outputSummary = getOutputSummary(
        state,
        result as Record<string, unknown>,
        outputSummarizer,
      );
      const tokensUsed = extractTokensDelta(
        state,
        result as Record<string, unknown>,
      );

      // debug 模式：记录执行后快照（合并 state + result）
      const stateAfter = debug
        ? sanitizeState({ ...state, ...result } as Record<string, unknown>)
        : undefined;

      // 异步写入，不阻塞节点返回
      persister
        .createStep({
          agentRunId: runId,
          nodeId,
          stepNumber,
          input: inputSummary,
          output: outputSummary,
          durationMs,
          tokensUsed,
          stateBefore,
          stateAfter,
        })
        .catch((err) => {
          console.error(`[StepRecorder] 写入步骤失败 (${nodeId}):`, err);
        });

      return result;
    } catch (err) {
      const durationMs = Date.now() - startTime;

      // 记录失败步骤（异常路径也记录 stateBefore）
      persister
        .createStep({
          agentRunId: runId,
          nodeId,
          stepNumber,
          input: inputSummary,
          output: { error: err instanceof Error ? err.message : String(err) },
          durationMs,
          tokensUsed: 0,
          stateBefore,
        })
        .catch((recordErr) => {
          console.error(
            `[StepRecorder] 写入失败步骤失败 (${nodeId}):`,
            recordErr,
          );
        });

      throw err;
    }
  };
}
