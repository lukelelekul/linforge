import type { PrismaClientLike } from './types';
import type { GraphDefinition, GraphStore } from 'linforge/core';
import { toJson, fromJson } from './json';

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
      nodes: fromJson(row.nodes),
      edges: fromJson(row.edges),
    };
  }

  async saveGraph(graph: GraphDefinition): Promise<void> {
    const data = {
      name: graph.name,
      icon: graph.icon ?? null,
      nodes: toJson(graph.nodes),
      edges: toJson(graph.edges),
    };
    await (this.prisma as any).linforgeGraph.upsert({
      where: { slug: graph.slug },
      update: data,
      create: { id: graph.id, slug: graph.slug, ...data },
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
      nodes: fromJson(row.nodes),
      edges: fromJson(row.edges),
    }));
  }
}
