// RunManager — 运行管理器
// 管理 AbortController + Promise 跟踪，通过 RunStore 接口回写状态

import type { Runnable } from '@langchain/core/runnables';
import type { RunCallbacks, RunOptions, RunRecord, RunStore } from './types';
import { clearStepCounter } from './StepRecorder';

interface RunningEntry {
  abortController: AbortController;
  promise: Promise<void>;
  startedAt: number;
}

/**
 * Run Manager
 * Manages background execution, cancellation, and status tracking of Agent graphs
 */
export class RunManager {
  private running = new Map<string, RunningEntry>();

  /**
   * Start graph execution (non-blocking)
   * graph.invoke() runs in the background, writes status back via store
   */
  startRun(graph: Runnable, options: RunOptions): void {
    const {
      runId,
      graphSlug,
      input,
      storeInput,
      store,
      callbacks,
      timeoutMs = 300_000,
    } = options;

    if (this.running.has(runId)) {
      throw new Error(`RunManager: 运行 "${runId}" 已在执行中`);
    }

    const abortController = new AbortController();

    // 超时自动取消
    const timeout = setTimeout(() => {
      abortController.abort(new Error(`运行超时 (${timeoutMs}ms)`));
    }, timeoutMs);

    const promise = (async () => {
      try {
        // 创建运行记录
        if (store) {
          await store.createRun({
            id: runId,
            graphSlug,
            status: 'running',
            input: storeInput ?? input,
            tokensUsed: 0,
            startedAt: new Date(),
          });
        }

        const result = await graph.invoke(input, {
          signal: abortController.signal,
        });

        if (store) {
          await store.updateRunStatus(runId, 'completed');
        }
        await callbacks?.onCompleted?.(runId, result);
      } catch (err) {
        // 取消操作不算错误
        if (abortController.signal.aborted) {
          if (store) {
            await store.updateRunStatus(runId, 'cancelled');
          }
          return;
        }

        const errorMessage = err instanceof Error ? err.message : String(err);
        if (store) {
          await store.updateRunStatus(runId, 'failed', {
            error: errorMessage,
          });
        }
        await callbacks?.onFailed?.(runId, err as Error);
      } finally {
        clearTimeout(timeout);
        clearStepCounter(runId);
        this.running.delete(runId);
      }
    })();

    this.running.set(runId, {
      abortController,
      promise,
      startedAt: Date.now(),
    });
  }

  /** Trigger abort signal */
  abortRun(runId: string): boolean {
    const entry = this.running.get(runId);
    if (!entry) return false;

    entry.abortController.abort();
    return true;
  }

  /** Check if a run is currently active */
  isRunning(runId: string): boolean {
    return this.running.has(runId);
  }

  /** Get all active run IDs */
  getRunningIds(): string[] {
    return Array.from(this.running.keys());
  }

  /** Get the number of active runs */
  get runningCount(): number {
    return this.running.size;
  }
}
