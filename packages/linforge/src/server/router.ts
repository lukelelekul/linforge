// Server routes — Linforge HTTP API implemented with @koa/router

import type Koa from 'koa';
import Router from '@koa/router';
import { NodeRegistry } from '../core/NodeRegistry';
import { GraphCompiler } from '../core/GraphCompiler';
import type { RunManager } from '../core/RunManager';
import type { TemplateRegistry } from '../core/TemplateRegistry';
import type {
  GraphStore,
  RunStore,
  StepPersister,
  PromptStore,
} from '../core/types';
import type { AgentContext } from './middleware';
import { applyTemplate } from '../core/applyTemplate';
import crypto from 'node:crypto';

export interface MountRoutesOptions {
  /** Agent 上下文映射（多 Agent 模式） */
  agentContextMap?: Map<string, AgentContext>;

  // —— 旧字段保留，向后兼容 ——
  /** Registry of registered nodes */
  registry?: NodeRegistry;
  /** Graph compiler */
  compiler?: GraphCompiler;
  /** StateSchema required for compilation */
  stateSchema?: any;
  /** Build graph input: transform instruction into graph.invoke() input */
  buildInput?: (instruction: string) => Record<string, unknown>;

  // —— 不变 ——
  /** Graph definition store */
  graphStore: GraphStore;
  /** Run manager */
  runManager: RunManager;
  /** Run record store (optional) */
  runStore?: RunStore;
  /** Step record store (optional, enables steps query route when provided) */
  stepPersister?: StepPersister;
  /** Prompt store (optional, enables Prompt CRUD routes when provided) */
  promptStore?: PromptStore;
  /** Template registry (optional, template API returns empty list if not provided) */
  templateRegistry?: TemplateRegistry;
  /** Enable debug mode: record full state snapshots (requires stepPersister) */
  stepRecordingDebug?: boolean;
  /** Route prefix, defaults to "/linforge" */
  prefix?: string;
  /** 是否为 code-first 模式（agents 模式） */
  codeFirst?: boolean;
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 按 slug 解析 AgentContext。
 * 优先精确匹配，降级到通配符 '*'。
 */
function resolveAgentContext(
  slug: string,
  map: Map<string, AgentContext>,
): AgentContext | undefined {
  return map.get(slug) ?? map.get('*');
}

/**
 * 将旧字段包装为 agentContextMap（兼容旧用法）。
 */
function ensureAgentContextMap(options: MountRoutesOptions): Map<string, AgentContext> {
  if (options.agentContextMap) {
    return options.agentContextMap;
  }

  // 旧字段兼容：构建通配符 context
  if (!options.registry || !options.compiler || !options.stateSchema) {
    throw new Error(
      '[linforge] createLinforgeRouter 需要 agentContextMap 或 registry + compiler + stateSchema',
    );
  }

  const defaultBuildInput = (instruction: string) => ({ instruction });
  const map = new Map<string, AgentContext>();
  map.set('*', {
    registry: options.registry,
    compiler: options.compiler,
    stateSchema: options.stateSchema,
    buildInput: options.buildInput ?? defaultBuildInput,
  });
  return map;
}

/**
 * Mount Linforge routes onto a Koa application
 *
 * Route list:
 * - GET  {prefix}/graphs                     — Graph list (compact)
 * - POST {prefix}/graphs                     — Create new graph
 * - PATCH {prefix}/graphs/:slug              — Edit graph basic info
 * - GET  {prefix}/registry/nodes             — Registered node list
 * - GET  {prefix}/graph/:slug                — Get graph definition
 * - PUT  {prefix}/graph/:slug                — Save/update graph definition
 * - POST {prefix}/graph/:slug/run            — Trigger a run
 * - GET  {prefix}/graph/:slug/runs           — Run history list (paginated)
 * - GET  {prefix}/runs/:runId               — Run details
 * - GET  {prefix}/runs/:runId/steps         — Step list
 * - GET  {prefix}/prompts/:nodeId            — Prompt version list
 * - GET  {prefix}/prompts/:nodeId/active     — Active prompt version
 * - POST {prefix}/prompts/:nodeId            — Create new prompt version
 * - POST {prefix}/prompts/:nodeId/versions/:id/activate — Activate specific version
 * - GET  {prefix}/templates                  — Available template list
 * - POST {prefix}/graph/:slug/apply-template — Apply template to graph
 */
/**
 * 创建 Linforge Router 实例（不挂载到 app）。
 * 供 mountRoutes() 和 linforgeMiddleware() 共用。
 */
export function createLinforgeRouter(options: MountRoutesOptions): Router {
  const {
    graphStore,
    runManager,
    runStore,
    stepPersister,
    promptStore,
    templateRegistry,
    stepRecordingDebug = false,
    prefix = '/linforge',
    codeFirst = false,
  } = options;

  // 统一构建 agentContextMap
  const agentContextMap = ensureAgentContextMap(options);

  // Auto-build stepRecording config (enabled when stepPersister is provided)
  const stepRecordingConfig = stepPersister
    ? {
        persister: stepPersister,
        debug: stepRecordingDebug,
      }
    : undefined;

  // runId injection key used by stepRecording
  const runIdKey = 'agentRunId';

  const router = new Router({ prefix });

  // GET /graphs — Return all graph definitions (compact)
  router.get('/graphs', async (ctx) => {
    const graphs = await graphStore.listGraphs();
    ctx.body = {
      graphs: graphs.map((g) => ({
        id: g.id,
        slug: g.slug,
        name: g.name,
        icon: g.icon,
        nodeCount: g.nodes.length,
        edgeCount: g.edges.length,
      })),
      codeFirst,
    };
  });

  // POST /graphs — Create new graph
  router.post('/graphs', async (ctx) => {
    // code-first 模式下，Graph 由代码注册，不允许通过 API 创建
    if (codeFirst) {
      ctx.status = 403;
      ctx.body = {
        error: 'Code-first 模式下，Agent 由代码注册，不允许通过 API 创建',
      };
      return;
    }

    const body = (ctx.request as any).body as
      | Record<string, unknown>
      | undefined;

    if (
      !body ||
      typeof body.name !== 'string' ||
      !body.name.trim() ||
      typeof body.slug !== 'string' ||
      !body.slug.trim()
    ) {
      ctx.status = 400;
      ctx.body = {
        error: 'name and slug are required fields (non-empty string)',
      };
      return;
    }

    const slug = body.slug as string;

    // slug format validation
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)) {
      ctx.status = 400;
      ctx.body = {
        error:
          'Invalid slug format (only lowercase letters, digits, hyphens allowed; cannot start or end with hyphen)',
      };
      return;
    }

    // Check if slug already exists
    const existing = await graphStore.getGraph(slug);
    if (existing) {
      ctx.status = 409;
      ctx.body = { error: `slug "${slug}" already exists` };
      return;
    }

    const graphDef = {
      id: slug,
      slug,
      name: (body.name as string).trim(),
      icon: typeof body.icon === 'string' ? body.icon : undefined,
      nodes: [
        { key: '__start__', label: '开始', nodeType: 'start' as const },
        { key: '__end__', label: '结束', nodeType: 'end' as const },
      ],
      edges: [],
    };

    await graphStore.saveGraph(graphDef);
    ctx.status = 201;
    ctx.body = graphDef;
  });

  // PATCH /graphs/:slug — Edit graph basic info (name, icon)
  router.patch('/graphs/:slug', async (ctx) => {
    const { slug } = ctx.params;
    const body = (ctx.request as any).body as
      | Record<string, unknown>
      | undefined;

    const existing = await graphStore.getGraph(slug);
    if (!existing) {
      ctx.status = 404;
      ctx.body = { error: `Graph "${slug}" not found` };
      return;
    }

    // Apply updates
    if (body && typeof body.name === 'string' && body.name.trim()) {
      existing.name = body.name.trim();
    }
    if (body && typeof body.icon === 'string') {
      existing.icon = body.icon;
    }

    await graphStore.saveGraph(existing);
    ctx.body = existing;
  });

  // GET /registry/nodes — Return registered node list
  // Optional ?graphSlug=xxx param, compares binding status against that graph if provided
  router.get('/registry/nodes', async (ctx) => {
    const graphSlug = ctx.query.graphSlug as string | undefined;

    // 解析对应 agent 的 registry
    const agentCtx = resolveAgentContext(graphSlug || '*', agentContextMap);
    if (!agentCtx) {
      ctx.status = 404;
      ctx.body = { error: `未找到 slug "${graphSlug}" 对应的 Agent 配置` };
      return;
    }
    const { registry } = agentCtx;

    if (graphSlug) {
      const graphDef = await graphStore.getGraph(graphSlug);
      if (!graphDef) {
        ctx.status = 404;
        ctx.body = { error: `Graph "${graphSlug}" not found` };
        return;
      }
      const bindingStatus = registry.getBindingStatus(graphDef);
      const nodes = registry.keys().map((key) => {
        const nodeDef = registry.get(key);
        const routeKeys = nodeDef?.routes ? Object.keys(nodeDef.routes) : [];
        return {
          key,
          label: nodeDef?.label || key,
          bound: bindingStatus.bound.includes(key),
          routeKeys,
        };
      });
      // Add skeleton nodes (defined in DB but no Registry implementation)
      for (const skeletonKey of bindingStatus.skeleton) {
        nodes.push({
          key: skeletonKey,
          label: skeletonKey,
          bound: false,
          routeKeys: [],
        });
      }
      ctx.body = { nodes };
    } else {
      const nodes = registry.keys().map((key) => {
        const nodeDef = registry.get(key);
        const routeKeys = nodeDef?.routes ? Object.keys(nodeDef.routes) : [];
        return { key, label: nodeDef?.label || key, routeKeys };
      });
      ctx.body = { nodes };
    }
  });

  // GET /graph/:slug — Get graph definition (with skeletonKeys)
  router.get('/graph/:slug', async (ctx) => {
    const { slug } = ctx.params;
    const graphDef = await graphStore.getGraph(slug);

    if (!graphDef) {
      ctx.status = 404;
      ctx.body = { error: `Graph "${slug}" not found` };
      return;
    }

    // 从 agentContextMap 获取对应的 registry
    const agentCtx = resolveAgentContext(slug, agentContextMap);
    if (!agentCtx) {
      ctx.status = 404;
      ctx.body = { error: `未找到 slug "${slug}" 对应的 Agent 配置` };
      return;
    }

    const { skeleton } = agentCtx.registry.getBindingStatus(graphDef);
    ctx.body = { ...graphDef, skeletonKeys: skeleton };
  });

  // PUT /graph/:slug — Save/update graph definition
  router.put('/graph/:slug', async (ctx) => {
    const { slug } = ctx.params;
    const body = (ctx.request as any).body as
      | Record<string, unknown>
      | undefined;

    if (!body || !Array.isArray(body.nodes) || !Array.isArray(body.edges)) {
      ctx.status = 400;
      ctx.body = { error: 'nodes and edges must be arrays' };
      return;
    }

    // 从 agentContextMap 获取对应的 registry
    const agentCtx = resolveAgentContext(slug, agentContextMap);
    if (!agentCtx) {
      ctx.status = 404;
      ctx.body = { error: `未找到 slug "${slug}" 对应的 Agent 配置` };
      return;
    }

    // Preserve existing graph's id/name (if exists)
    const existing = await graphStore.getGraph(slug);
    const graphDef = {
      id: existing?.id || slug,
      slug,
      name: (body.name as string) || existing?.name || slug,
      nodes: body.nodes,
      edges: body.edges,
    };

    await graphStore.saveGraph(graphDef as any);
    const { skeleton } = agentCtx.registry.getBindingStatus(graphDef as any);
    ctx.body = { ...graphDef, skeletonKeys: skeleton };
  });

  // POST /graph/:slug/run — Trigger a run
  router.post('/graph/:slug/run', async (ctx) => {
    const { slug } = ctx.params;
    // body is parsed by host app's bodyParser middleware, type assertion needed
    const body = (ctx.request as any).body as
      | Record<string, unknown>
      | undefined;

    if (
      !body ||
      typeof body.instruction !== 'string' ||
      !body.instruction.trim()
    ) {
      ctx.status = 400;
      ctx.body = {
        error: 'instruction is a required field (non-empty string)',
      };
      return;
    }

    const instruction = body.instruction as string;
    const runId = (body.runId as string) || crypto.randomUUID();
    const metadata =
      body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
        ? (body.metadata as Record<string, unknown>)
        : undefined;

    // Get graph definition
    const graphDef = await graphStore.getGraph(slug);
    if (!graphDef) {
      ctx.status = 404;
      ctx.body = { error: `Graph "${slug}" not found` };
      return;
    }

    // 从 agentContextMap 获取对应的 compiler + stateSchema + buildInput
    const agentCtx = resolveAgentContext(slug, agentContextMap);
    if (!agentCtx) {
      ctx.status = 404;
      ctx.body = { error: `未找到 slug "${slug}" 对应的 Agent 配置` };
      return;
    }

    const { compiler, stateSchema, buildInput } = agentCtx;

    // Compile graph (auto-wires stepRecording)
    const { graph } = compiler.compile({
      stateSchema,
      graphDef,
      stepRecording: stepRecordingConfig,
    });

    // Build input + auto-inject runId (required by StepRecorder)
    const graphInput = {
      ...buildInput(instruction),
      ...(stepRecordingConfig ? { [runIdKey]: runId } : {}),
    };
    // Store input with original instruction text (for RunPanel display)
    const storeInput = { instruction, ...graphInput };
    runManager.startRun(graph, {
      runId,
      graphSlug: slug,
      input: graphInput,
      storeInput,
      store: runStore,
      metadata,
    });

    ctx.status = 202;
    ctx.body = { runId };
  });

  // GET /graph/:slug/runs — Run history list (paginated)
  router.get('/graph/:slug/runs', async (ctx) => {
    if (!runStore) {
      ctx.status = 501;
      ctx.body = { error: 'RunStore not configured' };
      return;
    }

    const { slug } = ctx.params;
    const limit = Math.min(Number(ctx.query.limit) || 20, 100);
    const offset = Math.max(Number(ctx.query.offset) || 0, 0);

    // 解析 meta.* query 参数为 metadata 过滤条件
    const metadataFilter: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(ctx.query)) {
      if (key.startsWith('meta.') && typeof value === 'string') {
        metadataFilter[key.slice(5)] = value;
      }
    }
    const hasMetadataFilter = Object.keys(metadataFilter).length > 0;

    const runs = await runStore.listRuns(slug, {
      limit,
      offset,
      ...(hasMetadataFilter && { metadata: metadataFilter }),
    });
    ctx.body = { runs };
  });

  // GET /runs/:runId — Run details
  router.get('/runs/:runId', async (ctx) => {
    if (!runStore) {
      ctx.status = 501;
      ctx.body = { error: 'RunStore not configured' };
      return;
    }

    const run = await runStore.getRun(ctx.params.runId);
    if (!run) {
      ctx.status = 404;
      ctx.body = { error: `Run "${ctx.params.runId}" not found` };
      return;
    }

    ctx.body = run;
  });

  // GET /runs/:runId/steps — Step list
  // Optional ?includeSnapshots=true to include stateBefore/stateAfter (omitted by default to reduce payload)
  router.get('/runs/:runId/steps', async (ctx) => {
    if (!stepPersister) {
      ctx.status = 501;
      ctx.body = { error: 'StepPersister not configured' };
      return;
    }

    const includeSnapshots = ctx.query.includeSnapshots === 'true';
    const steps = await stepPersister.getSteps(ctx.params.runId);

    if (includeSnapshots) {
      ctx.body = { steps };
    } else {
      // Strip snapshot fields to reduce payload size
      ctx.body = {
        steps: steps.map(({ stateBefore, stateAfter, ...rest }) => rest),
      };
    }
  });

  // GET /prompts/:nodeId — Version list (desc)
  router.get('/prompts/:nodeId', async (ctx) => {
    if (!promptStore) {
      ctx.status = 501;
      ctx.body = { error: 'PromptStore not configured' };
      return;
    }

    const versions = await promptStore.listVersions(ctx.params.nodeId);
    ctx.body = { versions };
  });

  // GET /prompts/:nodeId/active — Active version
  router.get('/prompts/:nodeId/active', async (ctx) => {
    if (!promptStore) {
      ctx.status = 501;
      ctx.body = { error: 'PromptStore not configured' };
      return;
    }

    const active = await promptStore.getActivePrompt(ctx.params.nodeId);
    if (!active) {
      ctx.status = 404;
      ctx.body = { error: `No active prompt for node "${ctx.params.nodeId}"` };
      return;
    }

    ctx.body = active;
  });

  // POST /prompts/:nodeId — Create new version
  router.post('/prompts/:nodeId', async (ctx) => {
    if (!promptStore) {
      ctx.status = 501;
      ctx.body = { error: 'PromptStore not configured' };
      return;
    }

    const body = (ctx.request as any).body as
      | Record<string, unknown>
      | undefined;

    if (!body || typeof body.template !== 'string' || !body.template.trim()) {
      ctx.status = 400;
      ctx.body = { error: 'template is a required field (non-empty string)' };
      return;
    }

    const version = await promptStore.createVersion(ctx.params.nodeId, {
      template: body.template as string,
      temperature:
        typeof body.temperature === 'number' ? body.temperature : undefined,
    });

    ctx.status = 201;
    ctx.body = version;
  });

  // POST /prompts/:nodeId/versions/:id/activate — Activate specific version
  router.post('/prompts/:nodeId/versions/:id/activate', async (ctx) => {
    if (!promptStore) {
      ctx.status = 501;
      ctx.body = { error: 'PromptStore not configured' };
      return;
    }

    await promptStore.activateVersion(ctx.params.nodeId, ctx.params.id);
    ctx.status = 200;
    ctx.body = { ok: true };
  });

  // GET /templates — Return available template list
  router.get('/templates', async (ctx) => {
    const templates = templateRegistry ? templateRegistry.list() : [];
    ctx.body = { templates };
  });

  // POST /graph/:slug/apply-template — Apply template to graph (append-merge)
  router.post('/graph/:slug/apply-template', async (ctx) => {
    const { slug } = ctx.params;
    const body = (ctx.request as any).body as
      | Record<string, unknown>
      | undefined;

    if (!body || typeof body.templateId !== 'string') {
      ctx.status = 400;
      ctx.body = { error: 'templateId is a required field' };
      return;
    }

    if (!templateRegistry) {
      ctx.status = 400;
      ctx.body = { error: 'TemplateRegistry not configured' };
      return;
    }

    const template = templateRegistry.get(body.templateId as string);
    if (!template) {
      ctx.status = 404;
      ctx.body = { error: `Template "${body.templateId}" not found` };
      return;
    }

    // 从 agentContextMap 获取对应的 registry
    const agentCtx = resolveAgentContext(slug, agentContextMap);
    if (!agentCtx) {
      ctx.status = 404;
      ctx.body = { error: `未找到 slug "${slug}" 对应的 Agent 配置` };
      return;
    }

    // Get existing graph definition (create empty graph if not found)
    let existing = await graphStore.getGraph(slug);
    if (!existing) {
      existing = {
        id: slug,
        slug,
        name: slug,
        nodes: [
          { key: '__start__', label: '开始', nodeType: 'start' },
          { key: '__end__', label: '结束', nodeType: 'end' },
        ],
        edges: [],
      };
    }

    const { graph: updatedGraph, renamedKeys } = applyTemplate(
      template,
      existing,
    );
    await graphStore.saveGraph(updatedGraph);

    const { skeleton } = agentCtx.registry.getBindingStatus(updatedGraph);
    ctx.body = {
      ...updatedGraph,
      skeletonKeys: skeleton,
      renamedKeys,
    };
  });

  return router;
}

/**
 * Mount Linforge routes onto a Koa application
 */
export function mountRoutes(app: Koa, options: MountRoutesOptions): void {
  const router = createLinforgeRouter(options);
  app.use(router.routes());
  app.use(router.allowedMethods());
}
