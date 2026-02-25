import type { PrismaClientLike } from './types';
import type { RunRecord, RunStore } from 'linforge/core';

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
        input: run.input as any ?? undefined,
        result: run.result as any ?? undefined,
        metadata: run.metadata as any ?? undefined,
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
    const { limit = 20, offset = 0, metadata } = opts ?? {};

    // 构建 where 条件
    const where: any = { graphSlug };

    // metadata JSON 过滤：逐个 key 用 Prisma 的 path 查询
    if (metadata) {
      for (const [key, value] of Object.entries(metadata)) {
        where.metadata = {
          ...where.metadata,
          path: [key],
          equals: value,
        };
      }
    }

    const rows = await (this.prisma as any).linforgeRun.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return rows.map((row: any) => this.toRunRecord(row));
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
      update.result = data as any;
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
      input: row.input ?? undefined,
      result: row.result ?? undefined,
      metadata: row.metadata ?? undefined,
      tokensUsed: row.tokensUsed,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt ?? undefined,
    };
  }
}
