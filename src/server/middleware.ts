// linforgeMiddleware — 一行接入 Linforge 后端的高层封装

import type Koa from 'koa';
import { z } from 'zod/v4';
import { StateSchema } from '@langchain/langgraph';
import { NodeRegistry } from '../core/NodeRegistry';
import { GraphCompiler } from '../core/GraphCompiler';
import { RunManager } from '../core/RunManager';
import { TemplateRegistry } from '../core/TemplateRegistry';
import { builtinTemplates } from '../core/builtinTemplates';
import {
  MemoryGraphStore,
  MemoryRunStore,
  MemoryStepPersister,
  MemoryPromptStore,
} from '../testing';
import { createLinforgeRouter } from './router';
import type {
  NodeDefinition,
  GraphStore,
  RunStore,
  StepPersister,
  PromptStore,
  GraphTemplate,
} from '../core/types';

// ============================================================
// 配置类型
// ============================================================

export interface LinforgeMiddlewareOptions {
  /** LangGraph StateSchema 实例 */
  stateSchema: any;
  /** 已定义的 node 数组 */
  nodes: NodeDefinition[];
  /** 路由前缀，默认 "/linforge" */
  prefix?: string;
  /** 自定义 Store 实现（未传使用 Memory 默认值） */
  stores?: {
    graphStore?: GraphStore;
    runStore?: RunStore;
    stepPersister?: StepPersister;
    promptStore?: PromptStore;
  };
  /** 将 instruction 转换为 graph.invoke() 输入 */
  buildInput?: (instruction: string) => Record<string, unknown>;
  /** 启用调试模式：记录完整 state 快照 */
  stepRecordingDebug?: boolean;
  /** 追加到内置模板的自定义模板 */
  templates?: GraphTemplate[];
  /** 是否禁用内置模板，默认 false */
  disableBuiltinTemplates?: boolean;
}

// ============================================================
// agentRunId 自动注入
// ============================================================

/**
 * 检测 stateSchema 是否包含 agentRunId 字段，
 * 不存在时自动创建扩展后的新 StateSchema。
 */
function ensureAgentRunId(stateSchema: any): any {
  const keys: string[] = stateSchema.getAllKeys();

  // 已有 agentRunId，直接返回
  if (keys.includes('agentRunId')) {
    return stateSchema;
  }

  // 自动注入：在原 fields 基础上追加 agentRunId
  try {
    const extendedSchema = new StateSchema({
      ...stateSchema.fields,
      agentRunId: z.string().default(''),
    });
    return extendedSchema;
  } catch (err) {
    throw new Error(
      '[linforge] 无法自动注入 agentRunId 到 StateSchema。' +
        '请手动在你的 StateSchema 中添加: agentRunId: z.string().default("")\n' +
        `原始错误: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ============================================================
// middleware 工厂函数
// ============================================================

/**
 * 创建 Linforge Koa 中间件。
 *
 * 最小用法：
 * ```ts
 * app.use(linforgeMiddleware({ stateSchema: MyState, nodes: [planner, tools] }))
 * ```
 */
export function linforgeMiddleware(
  options: LinforgeMiddlewareOptions,
): Koa.Middleware {
  const {
    nodes,
    prefix,
    stores = {},
    buildInput,
    stepRecordingDebug,
    templates = [],
    disableBuiltinTemplates = false,
  } = options;

  // 1. 自动注入 agentRunId
  const stateSchema = ensureAgentRunId(options.stateSchema);

  // 2. NodeRegistry — 自动注册所有 nodes
  const registry = new NodeRegistry();
  for (const node of nodes) {
    registry.register(node);
  }

  // 3. GraphCompiler + RunManager
  const compiler = new GraphCompiler(registry);
  const runManager = new RunManager();

  // 4. TemplateRegistry — 内置 + 自定义
  const templateRegistry = new TemplateRegistry();
  if (!disableBuiltinTemplates) {
    for (const t of builtinTemplates) {
      templateRegistry.register(t);
    }
  }
  for (const t of templates) {
    templateRegistry.register(t);
  }

  // 5. Stores — 未传使用 Memory 默认值
  const graphStore = stores.graphStore ?? new MemoryGraphStore();
  const runStore = stores.runStore ?? new MemoryRunStore();
  const stepPersister = stores.stepPersister ?? new MemoryStepPersister();
  const promptStore = stores.promptStore ?? new MemoryPromptStore();

  // 6. 创建路由
  const router = createLinforgeRouter({
    registry,
    compiler,
    graphStore,
    runManager,
    runStore,
    stepPersister,
    promptStore,
    templateRegistry,
    stateSchema,
    buildInput,
    stepRecordingDebug,
    prefix,
  });

  // 7. 返回组合后的 Koa 中间件 (routes + allowedMethods)
  const routes = router.routes();
  const allowedMethods = router.allowedMethods();

  return async (ctx, next) => {
    await routes(ctx as any, async () => {
      await allowedMethods(ctx as any, next);
    });
  };
}
