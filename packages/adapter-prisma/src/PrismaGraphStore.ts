import type { PrismaClientLike } from './types';
import type { GraphDefinition, GraphStore } from 'linforge/core';

/**
 * Prisma 实现的 GraphStore — 图定义持久化
 */
export class PrismaGraphStore implements GraphStore {
  constructor(private prisma: PrismaClientLike) {}

  async getGraph(slug: string): Promise<GraphDefinition | null> {
    const row = await (this.prisma as any).linforgeGraph.findUnique({
      where: { slug },
    });
    if (!row) return null;
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      icon: row.icon ?? undefined,
      nodes: row.nodes as GraphDefinition['nodes'],
      edges: row.edges as GraphDefinition['edges'],
    };
  }

  async saveGraph(graph: GraphDefinition): Promise<void> {
    await (this.prisma as any).linforgeGraph.upsert({
      where: { slug: graph.slug },
      update: {
        name: graph.name,
        icon: graph.icon ?? null,
        nodes: graph.nodes as any,
        edges: graph.edges as any,
      },
      create: {
        id: graph.id,
        slug: graph.slug,
        name: graph.name,
        icon: graph.icon ?? null,
        nodes: graph.nodes as any,
        edges: graph.edges as any,
      },
    });
  }

  async listGraphs(): Promise<GraphDefinition[]> {
    const rows = await (this.prisma as any).linforgeGraph.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row: any) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      icon: row.icon ?? undefined,
      nodes: row.nodes as GraphDefinition['nodes'],
      edges: row.edges as GraphDefinition['edges'],
    }));
  }
}
