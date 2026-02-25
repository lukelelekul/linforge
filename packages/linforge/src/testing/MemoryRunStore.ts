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
    opts?: { limit?: number; offset?: number; metadata?: Record<string, unknown> },
  ): Promise<RunRecord[]> {
    const { limit = 20, offset = 0, metadata } = opts ?? {};
    let matched = Array.from(this.runs.values())
      .filter((r) => r.graphSlug === graphSlug);

    // metadata 过滤：所有指定的 key-value 必须匹配
    if (metadata) {
      matched = matched.filter((r) => {
        if (!r.metadata) return false;
        return Object.entries(metadata).every(
          ([key, value]) => r.metadata![key] === value,
        );
      });
    }

    matched.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
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
