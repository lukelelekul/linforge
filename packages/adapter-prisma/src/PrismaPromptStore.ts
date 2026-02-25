import type { PrismaClientLike } from './types';
import type {
  PromptStore,
  PromptVersion,
  CreatePromptVersionInput,
} from 'linforge/core';

/**
 * Prisma 实现的 PromptStore — Prompt 版本管理
 */
export class PrismaPromptStore implements PromptStore {
  constructor(private prisma: PrismaClientLike) {}

  async getActivePrompt(nodeId: string): Promise<PromptVersion | null> {
    const row = await (this.prisma as any).linforgePromptVersion.findFirst({
      where: { nodeId, isActive: true },
    });
    if (!row) return null;
    return this.toPromptVersion(row);
  }

  /** 列出指定节点的所有版本，按 version 降序 */
  async listVersions(nodeId: string): Promise<PromptVersion[]> {
    const rows = await (this.prisma as any).linforgePromptVersion.findMany({
      where: { nodeId },
      orderBy: { version: 'desc' },
    });
    return rows.map((row: any) => this.toPromptVersion(row));
  }

  /** 创建新版本，version 号自动递增，默认 inactive */
  async createVersion(
    nodeId: string,
    data: CreatePromptVersionInput,
  ): Promise<PromptVersion> {
    // 查询当前最大 version
    const latest = await (this.prisma as any).linforgePromptVersion.findFirst({
      where: { nodeId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    const row = await (this.prisma as any).linforgePromptVersion.create({
      data: {
        nodeId,
        version: nextVersion,
        template: data.template,
        temperature: data.temperature ?? 0.3,
        isActive: false,
      },
    });

    return this.toPromptVersion(row);
  }

  /** 激活指定版本，使用事务确保同一 nodeId 下互斥 */
  async activateVersion(nodeId: string, versionId: string): Promise<void> {
    await this.prisma.$transaction([
      // 先将该节点的所有版本设为 inactive
      (this.prisma as any).linforgePromptVersion.updateMany({
        where: { nodeId, isActive: true },
        data: { isActive: false },
      }),
      // 再激活目标版本
      (this.prisma as any).linforgePromptVersion.update({
        where: { id: versionId },
        data: { isActive: true },
      }),
    ]);
  }

  private toPromptVersion(row: any): PromptVersion {
    return {
      id: row.id,
      nodeId: row.nodeId,
      version: row.version,
      template: row.template,
      temperature: row.temperature,
      isActive: row.isActive,
      createdAt: row.createdAt,
    };
  }
}
