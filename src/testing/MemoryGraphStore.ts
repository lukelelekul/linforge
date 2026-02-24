import type { GraphDefinition, GraphStore } from '../core/types';

/**
 * In-memory graph definition store adapter
 * For testing and example projects
 */
export class MemoryGraphStore implements GraphStore {
  private graphs = new Map<string, GraphDefinition>();

  async getGraph(slug: string): Promise<GraphDefinition | null> {
    return this.graphs.get(slug) ?? null;
  }

  async saveGraph(graph: GraphDefinition): Promise<void> {
    this.graphs.set(graph.slug, graph);
  }

  async listGraphs(): Promise<GraphDefinition[]> {
    return Array.from(this.graphs.values());
  }

  /** Convenience setter method */
  setGraph(slug: string, def: GraphDefinition): void {
    this.graphs.set(slug, def);
  }

  /** Clear all data */
  clear(): void {
    this.graphs.clear();
  }
}
