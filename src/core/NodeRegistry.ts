import type { GraphDefinition, NodeDefinition } from './types';

/**
 * Node Registry
 * Manages all node definitions created via defineNode()
 */
export class NodeRegistry {
  private nodes = new Map<string, NodeDefinition>();

  /** Register a node definition */
  register(node: NodeDefinition): void {
    if (this.nodes.has(node.key)) {
      throw new Error(
        `NodeRegistry: 节点 "${node.key}" 已注册，不允许重复注册`,
      );
    }
    this.nodes.set(node.key, node);
  }

  /** Register multiple node definitions */
  registerAll(nodes: NodeDefinition[]): void {
    for (const node of nodes) {
      this.register(node);
    }
  }

  /** Get a node definition by key */
  get(key: string): NodeDefinition | undefined {
    return this.nodes.get(key);
  }

  /** Check if a node is registered */
  has(key: string): boolean {
    return this.nodes.has(key);
  }

  /** Get all registered node keys */
  keys(): string[] {
    return Array.from(this.nodes.keys());
  }

  /** Get all registered node definitions */
  entries(): NodeDefinition[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Compare against a DB graph definition and return node binding status
   * - bound: defined in DB + implemented in Registry
   * - skeleton: defined in DB but not implemented in Registry
   */
  getBindingStatus(graphDef: GraphDefinition): {
    bound: string[];
    skeleton: string[];
  } {
    // 过滤掉 __start__ 和 __end__ 等内部节点
    const dbKeys = graphDef.nodes
      .map((n) => n.key)
      .filter((k) => !k.startsWith('__'));

    const bound: string[] = [];
    const skeleton: string[] = [];

    for (const key of dbKeys) {
      if (this.nodes.has(key)) {
        bound.push(key);
      } else {
        skeleton.push(key);
      }
    }

    return { bound, skeleton };
  }
}
