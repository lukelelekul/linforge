// PromptLoader — 通用 Prompt 模板加载器
// 通过 PromptStore 接口解耦 DB，宿主应用提供具体实现

import Mustache from 'mustache';
import type { PromptStore, PromptVersion } from './types';

/** render() 返回值 */
export interface RenderResult {
  /** 渲染后的完整文本 */
  text: string;
  /** LLM 温度参数 */
  temperature: number;
  /** 模板来源：DB 激活版本 or 代码默认值 */
  source: 'store' | 'fallback';
}

/** render() 的 fallback 参数 */
export interface PromptFallback {
  template: string;
  temperature?: number;
}

/**
 * 渲染 Mustache 模板（纯函数，不依赖 PromptStore）
 * 禁用 HTML 转义 — Prompt 场景不需要
 */
export function renderPrompt(
  template: string,
  vars: Record<string, unknown>,
): string {
  // 覆盖 escape 为恒等函数，禁用 HTML 转义
  (Mustache as any).escape = (text: string) => text;
  return Mustache.render(template, vars);
}

export interface PromptLoader {
  /** Get the active prompt for a node (with caching) */
  getActivePrompt(nodeId: string): Promise<PromptVersion | null>;
  /** Clear cache (call when active version changes) */
  invalidateCache(nodeId?: string): void;
  /** 加载模板并渲染变量，支持 fallback */
  render(
    nodeId: string,
    vars: Record<string, unknown>,
    fallback?: PromptFallback,
  ): Promise<RenderResult>;
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

    async render(
      nodeId: string,
      vars: Record<string, unknown>,
      fallback?: PromptFallback,
    ): Promise<RenderResult> {
      const prompt = await this.getActivePrompt(nodeId);

      if (prompt) {
        return {
          text: renderPrompt(prompt.template, vars),
          temperature: prompt.temperature,
          source: 'store' as const,
        };
      }

      if (fallback) {
        return {
          text: renderPrompt(fallback.template, vars),
          temperature: fallback.temperature ?? 0.7,
          source: 'fallback' as const,
        };
      }

      throw new Error(
        `No active prompt for node "${nodeId}" and no fallback provided`,
      );
    },
  };
}
