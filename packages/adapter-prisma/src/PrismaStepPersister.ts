import type { PrismaClientLike } from './types';
import type { StepData, StepPersister } from 'linforge/core';

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
        input: data.input as any,
        output: data.output as any,
        durationMs: data.durationMs,
        tokensUsed: data.tokensUsed,
        toolName: data.toolName ?? null,
        stateBefore: data.stateBefore as any ?? undefined,
        stateAfter: data.stateAfter as any ?? undefined,
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
      input: row.input,
      output: row.output,
      durationMs: row.durationMs,
      tokensUsed: row.tokensUsed,
      toolName: row.toolName ?? undefined,
      stateBefore: row.stateBefore ?? undefined,
      stateAfter: row.stateAfter ?? undefined,
    }));
  }
}
