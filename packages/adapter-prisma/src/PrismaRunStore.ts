import type { PrismaClientLike } from './types';
import type { RunRecord, RunStore } from 'linforge/core';
import { toJsonOrNull, fromJsonOrUndefined } from './json';

/**
 * Prisma 实现的 RunStore — 运行记录生命周期管理
 */
export class PrismaRunStore implements RunStore {
  constructor(private prisma: PrismaClientLike) {}

  async createRun(run: Omit<RunRecord, 'finishedAt'>): Promise<void> {
    await (this.prisma as any).linforgeRun.create({
      data: {
        id: run.id,
        graphSlug: run.graphSlug,
        status: run.status,
        input: toJsonOrNull(run.input),
        result: toJsonOrNull(run.result),
        metadata: toJsonOrNull(run.metadata),
        tokensUsed: run.tokensUsed,
        startedAt: run.startedAt,
      },
    });
  }

  async getRun(runId: string): Promise<RunRecord | null> {
    const row = await (this.prisma as any).linforgeRun.findUnique({
      where: { id: runId },
    });
    if (!row) return null;
    return this.toRunRecord(row);
  }

  async listRuns(
    graphSlug: string,
    opts?: { limit?: number; offset?: number; metadata?: Record<string, unknown> },
  ): Promise<RunRecord[]> {
    const { limit = 20, offset = 0 } = opts ?? {};

    const rows = await (this.prisma as any).linforgeRun.findMany({
      where: { graphSlug },
      orderBy: { startedAt: 'desc' },
      take: limit,
      skip: offset,
    });

    let results = rows.map((row: any) => this.toRunRecord(row));

    // metadata 过滤：应用层过滤（SQLite 不支持 JSON path 查询）
    if (opts?.metadata) {
      const meta = opts.metadata;
      results = results.filter((r: RunRecord) => {
        if (!r.metadata) return false;
        return Object.entries(meta).every(
          ([key, value]) => r.metadata![key] === value,
        );
      });
    }

    return results;
  }

  async updateRunStatus(
    runId: string,
    status: RunRecord['status'],
    data?: Record<string, unknown>,
  ): Promise<void> {
    const update: any = { status };

    // 非 running 状态自动设置 finishedAt
    if (status !== 'running') {
      update.finishedAt = new Date();
    }

    if (data) {
      update.result = toJsonOrNull(data);
    }

    await (this.prisma as any).linforgeRun.update({
      where: { id: runId },
      data: update,
    });
  }

  private toRunRecord(row: any): RunRecord {
    return {
      id: row.id,
      graphSlug: row.graphSlug,
      status: row.status as RunRecord['status'],
      input: fromJsonOrUndefined(row.input),
      result: fromJsonOrUndefined(row.result),
      metadata: fromJsonOrUndefined(row.metadata),
      tokensUsed: row.tokensUsed,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt ?? undefined,
    };
  }
}
