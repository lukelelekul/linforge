import type { RunRecord, RunStore } from '../core/types';

/**
 * In-memory run record store adapter
 * For testing and example projects
 */
export class MemoryRunStore implements RunStore {
  private runs = new Map<string, RunRecord>();

  async createRun(run: Omit<RunRecord, 'finishedAt'>): Promise<void> {
    this.runs.set(run.id, { ...run });
  }

  async getRun(runId: string): Promise<RunRecord | null> {
    return this.runs.get(runId) ?? null;
  }

  async listRuns(
    graphSlug: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<RunRecord[]> {
    const { limit = 20, offset = 0 } = opts ?? {};
    const matched = Array.from(this.runs.values())
      .filter((r) => r.graphSlug === graphSlug)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    return matched.slice(offset, offset + limit);
  }

  async updateRunStatus(
    runId: string,
    status: RunRecord['status'],
    data?: Record<string, unknown>,
  ): Promise<void> {
    const existing = this.runs.get(runId);
    if (existing) {
      existing.status = status;
      if (data) {
        existing.result = { ...existing.result, ...data };
      }
      if (status !== 'running') {
        existing.finishedAt = new Date();
      }
    } else {
      // Backward compatibility: updateRunStatus works even without a prior createRun
      this.runs.set(runId, {
        id: runId,
        graphSlug: '',
        status,
        result: data,
        tokensUsed: 0,
        startedAt: new Date(),
        finishedAt: status !== 'running' ? new Date() : undefined,
      });
    }
  }

  /** Clear all data */
  clear(): void {
    this.runs.clear();
  }
}
