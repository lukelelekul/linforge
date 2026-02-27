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

/** 单个 Agent 的配置 */
export interface AgentConfig {
  /** Graph slug（一个 Agent 对应一个 slug） */
  slug: string;
  /** 显示名称（用于工作台列表） */
  name: string;
  /** 该 Agent 的 LangGraph StateSchema */
  stateSchema: any;
  /** 该 Agent 的 node 实现列表 */
  nodes: NodeDefinition[];
  /** 该 Agent 的 buildInput（可覆盖全局） */
  buildInput?: (instruction: string) => Record<string, unknown>;
}

/** router 层按 slug 查找的上下文 */
export interface AgentContext {
  registry: NodeRegistry;
  compiler: GraphCompiler;
  stateSchema: any;
  buildInput: (instruction: string) => Record<string, unknown>;
}

export interface LinforgeMiddlewareOptions {
  // —— 新增：多 Agent 模式 ——
  /** 多 Agent 配置（与 stateSchema/nodes 二选一） */
  agents?: AgentConfig[];
  /** 在多 Agent 模式下，注册到每个 agent 的公共节点 */
  sharedNodes?: NodeDefinition[];

  // —— 保留：单 Agent 模式（向后兼容）——
  /** LangGraph StateSchema 实例 */
  stateSchema?: any;
  /** 已定义的 node 数组 */
  nodes?: NodeDefinition[];

  // —— 不变 ——
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
// 配置规范化
// ============================================================

/** 通配符 slug，匹配所有 slug（向后兼容旧模式） */
export const WILDCARD_SLUG = '*';

/**
 * 将用户传入的 options 规范化为 agentConfigs 数组。
 * - 有 agents → 直接使用
 * - 无 agents → 将 { stateSchema, nodes } 包装为 [{ slug: '*', ... }]
 */
function normalizeAgentConfigs(options: LinforgeMiddlewareOptions): {
  agentConfigs: AgentConfig[];
  sharedNodes: NodeDefinition[];
} {
  if (options.agents && options.agents.length > 0) {
    return {
      agentConfigs: options.agents,
      sharedNodes: options.sharedNodes ?? [],
    };
  }

  // 单 Agent 模式：向后兼容
  if (!options.stateSchema || !options.nodes) {
    throw new Error(
      '[linforge] 必须提供 agents 数组或 stateSchema + nodes 配置',
    );
  }

  return {
    agentConfigs: [
      {
        slug: WILDCARD_SLUG,
        name: 'Default',
        stateSchema: options.stateSchema,
        nodes: options.nodes,
        buildInput: options.buildInput,
      },
    ],
    sharedNodes: [],
  };
}

// ============================================================
// 构建 agentContextMap
// ============================================================

/**
 * 为每个 agent 创建独立的 NodeRegistry + GraphCompiler。
 */
function buildAgentContextMap(
  agentConfigs: AgentConfig[],
  sharedNodes: NodeDefinition[],
  globalBuildInput?: (instruction: string) => Record<string, unknown>,
): Map<string, AgentContext> {
  const map = new Map<string, AgentContext>();

  // 检测 slug 冲突
  const slugSet = new Set<string>();
  for (const agent of agentConfigs) {
    if (slugSet.has(agent.slug)) {
      throw new Error(
        `[linforge] agents 配置中存在重复的 slug: "${agent.slug}"`,
      );
    }
    slugSet.add(agent.slug);
  }

  const defaultBuildInput = (instruction: string) => ({ instruction });

  for (const agent of agentConfigs) {
    // 每个 agent 独立的 NodeRegistry
    const registry = new NodeRegistry();

    // 先注册 sharedNodes
    for (const node of sharedNodes) {
      registry.register(node);
    }

    // 再注册 agent 自身的 nodes
    for (const node of agent.nodes) {
      registry.register(node);
    }

    // 自动注入 agentRunId
    const stateSchema = ensureAgentRunId(agent.stateSchema);

    // 独立的 GraphCompiler
    const compiler = new GraphCompiler(registry);

    // buildInput 优先级: agent.buildInput > globalBuildInput > defaultBuildInput
    const buildInput =
      agent.buildInput ?? globalBuildInput ?? defaultBuildInput;

    map.set(agent.slug, { registry, compiler, stateSchema, buildInput });
  }

  return map;
}

// ============================================================
// 启动时自动同步 GraphStore
// ============================================================

/**
 * 遍历 agentConfigs，为每个非通配符 slug 在 GraphStore 中创建空拓扑（如不存在）。
 */
async function syncGraphStore(
  agentConfigs: AgentConfig[],
  graphStore: GraphStore,
): Promise<void> {
  for (const agent of agentConfigs) {
    // 通配符模式不同步
    if (agent.slug === WILDCARD_SLUG) continue;

    const existing = await graphStore.getGraph(agent.slug);
    if (!existing) {
      // 创建带 __start__ + __end__ 的空拓扑
      await graphStore.saveGraph({
        id: agent.slug,
        slug: agent.slug,
        name: agent.name,
        nodes: [
          { key: '__start__', label: '开始', nodeType: 'start' as const },
          { key: '__end__', label: '结束', nodeType: 'end' as const },
        ],
        edges: [],
      });
    }
    // 已存在 → 不覆盖（保留用户在画布上编辑的拓扑）
  }
}

// ============================================================
// middleware 工厂函数
// ============================================================

/**
 * 创建 Linforge Koa 中间件。
 *
 * 最小用法（单 Agent 模式）：
 * ```ts
 * app.use(linforgeMiddleware({ stateSchema: MyState, nodes: [planner, tools] }))
 * ```
 *
 * 多 Agent 模式：
 * ```ts
 * app.use(linforgeMiddleware({
 *   agents: [
 *     { slug: 'qa-bot', name: 'QA Bot', stateSchema: QAState, nodes: [retriever, answerer] },
 *     { slug: 'coder', name: 'Coder', stateSchema: CoderState, nodes: [planner, coder] },
 *   ],
 *   sharedNodes: [logger],
 * }))
 * ```
 */
export function linforgeMiddleware(
  options: LinforgeMiddlewareOptions,
): Koa.Middleware {
  const {
    prefix,
    stores = {},
    buildInput,
    stepRecordingDebug,
    templates = [],
    disableBuiltinTemplates = false,
  } = options;

  // 1. 规范化 agent 配置
  const { agentConfigs, sharedNodes } = normalizeAgentConfigs(options);

  // 2. 构建 agentContextMap
  const agentContextMap = buildAgentContextMap(
    agentConfigs,
    sharedNodes,
    buildInput,
  );

  // 3. RunManager（全局共享）
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

  // 6. 是否为 code-first 模式（agents 模式，非通配符）
  const isCodeFirst = agentConfigs.some((a) => a.slug !== WILDCARD_SLUG);

  // 7. Lazy sync：首次请求时同步 GraphStore
  let syncPromise: Promise<void> | null = null;

  // 8. 创建路由
  const router = createLinforgeRouter({
    agentContextMap,
    graphStore,
    runManager,
    runStore,
    stepPersister,
    promptStore,
    templateRegistry,
    stepRecordingDebug,
    prefix,
    codeFirst: isCodeFirst,
  });

  // 9. 返回组合后的 Koa 中间件 (routes + allowedMethods)
  const routes = router.routes();
  const allowedMethods = router.allowedMethods();

  return async (ctx, next) => {
    // lazy sync：首次请求时触发 GraphStore 同步
    if (!syncPromise && isCodeFirst) {
      syncPromise = syncGraphStore(agentConfigs, graphStore);
    }
    if (syncPromise) {
      await syncPromise;
    }

    await routes(ctx as any, async () => {
      await allowedMethods(ctx as any, next);
    });
  };
}
