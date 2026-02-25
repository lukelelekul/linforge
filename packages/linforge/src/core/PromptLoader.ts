// PromptLoader — 通用 Prompt 模板加载器
// 通过 PromptStore 接口解耦 DB，宿主应用提供具体实现

import type { PromptStore, PromptVersion } from './types';

export interface PromptLoader {
  /** Get the active prompt for a node (with caching) */
  getActivePrompt(nodeId: string): Promise<PromptVersion | null>;
  /** Clear cache (call when active version changes) */
  invalidateCache(nodeId?: string): void;
}

/**
 * Create a Prompt loader instance
 * In-memory cache + PromptStore queries
 */
export function createPromptLoader(store: PromptStore): PromptLoader {
  const cache = new Map<string, PromptVersion>();

  return {
    async getActivePrompt(nodeId: string): Promise<PromptVersion | null> {
      const cached = cache.get(nodeId);
      if (cached) return cached;

      const result = await store.getActivePrompt(nodeId);
      if (!result) return null;

      cache.set(nodeId, result);
      return result;
    },

    invalidateCache(nodeId?: string): void {
      if (nodeId) {
        cache.delete(nodeId);
      } else {
        cache.clear();
      }
    },
  };
}
