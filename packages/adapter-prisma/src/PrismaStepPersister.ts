import type { PrismaClientLike } from './types';
import type { StepData, StepPersister } from 'linforge/core';
import { toJson, toJsonOrNull, fromJson, fromJsonOrUndefined } from './json';

/**
 * Prisma 实现的 StepPersister — 步骤数据写入/查询
 */
export class PrismaStepPersister implements StepPersister {
  constructor(private prisma: PrismaClientLike) {}

  async createStep(data: StepData): Promise<void> {
    await (this.prisma as any).linforgeStep.create({
      data: {
        agentRunId: data.agentRunId,
        nodeId: data.nodeId,
        stepNumber: data.stepNumber,
        input: toJson(data.input),
        output: toJson(data.output),
        durationMs: data.durationMs,
        tokensUsed: data.tokensUsed,
        toolName: data.toolName ?? null,
        stateBefore: toJsonOrNull(data.stateBefore),
        stateAfter: toJsonOrNull(data.stateAfter),
      },
    });
  }

  /** 查询指定 run 的所有步骤，按 stepNumber 升序排列 */
  async getSteps(runId: string): Promise<StepData[]> {
    const rows = await (this.prisma as any).linforgeStep.findMany({
      where: { agentRunId: runId },
      orderBy: { stepNumber: 'asc' },
    });

    return rows.map((row: any): StepData => ({
      agentRunId: row.agentRunId,
      nodeId: row.nodeId,
      stepNumber: row.stepNumber,
      input: fromJson(row.input),
      output: fromJson(row.output),
      durationMs: row.durationMs,
      tokensUsed: row.tokensUsed,
      toolName: row.toolName ?? undefined,
      stateBefore: fromJsonOrUndefined(row.stateBefore),
      stateAfter: fromJsonOrUndefined(row.stateAfter),
    }));
  }
}
