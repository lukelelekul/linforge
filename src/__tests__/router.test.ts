import { describe, it, expect, afterEach, vi } from 'vitest';
import Koa from 'koa';
import { createServer } from 'node:http';
import { NodeRegistry } from '../core/NodeRegistry';
import { GraphCompiler } from '../core/GraphCompiler';
import { RunManager } from '../core/RunManager';
import { TemplateRegistry } from '../core/TemplateRegistry';
import { builtinTemplates } from '../core/builtinTemplates';
import { MemoryGraphStore } from '../testing/MemoryGraphStore';
import { MemoryRunStore } from '../testing/MemoryRunStore';
import { MemoryStepPersister } from '../testing/MemoryStepPersister';
import { MemoryPromptStore } from '../testing/MemoryPromptStore';
import { mountRoutes } from '../server/router';
import type { GraphDefinition } from '../core/types';

// 测试用图定义
const testGraphDef: GraphDefinition = {
  id: 'graph-1',
  slug: 'test-agent',
  name: '测试 Agent',
  nodes: [
    { key: '__start__', label: '开始' },
    { key: 'planner', label: '规划器' },
    { key: '__end__', label: '结束' },
  ],
  edges: [
    { source: '__start__', target: 'planner' },
    { source: 'planner', target: '__end__' },
  ],
};

// 启动测试服务器，返回 baseURL + 清理函数
async function createTestServer(
  options: Partial<Parameters<typeof mountRoutes>[1]> = {},
): Promise<{ baseURL: string; cleanup: () => Promise<void> }> {
  const registry = new NodeRegistry();
  registry.register({
    key: 'planner',
    routes: {
      hasTools: (state: any) => !!state.tools,
      noTools: (state: any) => !state.tools,
    },
    run: async (state: any) => state,
  });

  const compiler = new GraphCompiler(registry);
  const graphStore = new MemoryGraphStore();
  graphStore.setGraph('test-agent', testGraphDef);

  const runManager = new RunManager();

  const app = new Koa();

  // 简单的 body parser（测试用）
  app.use(async (ctx, next) => {
    if (
      ctx.method === 'POST' ||
      ctx.method === 'PUT' ||
      ctx.method === 'PATCH'
    ) {
      const body = await new Promise<string>((resolve) => {
        let data = '';
        ctx.req.on('data', (chunk: Buffer) => (data += chunk.toString()));
        ctx.req.on('end', () => resolve(data));
      });
      try {
        (ctx.request as any).body = JSON.parse(body);
      } catch {
        (ctx.request as any).body = {};
      }
    }
    await next();
  });

  mountRoutes(app, {
    registry,
    compiler,
    graphStore,
    runManager,
    stateSchema: options.stateSchema ?? createMockStateSchema(),
    buildInput: options.buildInput,
    prefix: options.prefix,
    ...options,
  } as any);

  const server = createServer(app.callback());

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const addr = server.address() as { port: number };
  const baseURL = `http://127.0.0.1:${addr.port}`;

  const cleanup = () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

  return { baseURL, cleanup };
}

// 模拟 StateSchema — compile() 中会传给 StateGraph 构造函数
// GraphCompiler.compile 依赖 LangGraph StateGraph，需要 mock
function createMockStateSchema() {
  return {}; // 测试中 compiler.compile 会被 spy 替代
}

describe('mountRoutes', () => {
  let baseURL: string;
  let cleanup: () => Promise<void>;

  afterEach(async () => {
    if (cleanup) await cleanup();
  });

  describe('GET /linforge/registry/nodes', () => {
    it('返回已注册节点列表（含 routeKeys）', async () => {
      ({ baseURL, cleanup } = await createTestServer());

      const res = await fetch(`${baseURL}/linforge/registry/nodes`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.nodes).toEqual([
        {
          key: 'planner',
          label: 'planner',
          routeKeys: ['hasTools', 'noTools'],
        },
      ]);
    });

    it('带 graphSlug 参数时返回绑定状态（含 routeKeys）', async () => {
      ({ baseURL, cleanup } = await createTestServer());

      const res = await fetch(
        `${baseURL}/linforge/registry/nodes?graphSlug=test-agent`,
      );
      expect(res.status).toBe(200);

      const data = await res.json();
      // planner 已注册所以 bound=true，且有 routeKeys
      expect(data.nodes).toContainEqual({
        key: 'planner',
        label: 'planner',
        bound: true,
        routeKeys: ['hasTools', 'noTools'],
      });
    });

    it('无 routes 的节点 routeKeys 为空数组', async () => {
      // 创建一个只有无 routes 节点的服务器
      const registry = new NodeRegistry();
      registry.register({
        key: 'simple',
        run: async (state: any) => state,
      });
      const compiler = new GraphCompiler(registry);
      const graphStore = new MemoryGraphStore();
      const runManager = new RunManager();

      const app = new Koa();
      app.use(async (ctx, next) => {
        if (
          ctx.method === 'POST' ||
          ctx.method === 'PUT' ||
          ctx.method === 'PATCH'
        ) {
          const body = await new Promise<string>((resolve) => {
            let data = '';
            ctx.req.on('data', (chunk: Buffer) => (data += chunk.toString()));
            ctx.req.on('end', () => resolve(data));
          });
          try {
            (ctx.request as any).body = JSON.parse(body);
          } catch {
            (ctx.request as any).body = {};
          }
        }
        await next();
      });

      mountRoutes(app, {
        registry,
        compiler,
        graphStore,
        runManager,
        stateSchema: {},
      });

      const srv = createServer(app.callback());
      await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
      const addr = srv.address() as { port: number };
      const url = `http://127.0.0.1:${addr.port}`;

      try {
        const res = await fetch(`${url}/linforge/registry/nodes`);
        const data = await res.json();
        expect(data.nodes).toEqual([
          { key: 'simple', label: 'simple', routeKeys: [] },
        ]);
      } finally {
        await new Promise<void>((r) => srv.close(() => r()));
      }
    });

    it('graphSlug 不存在时返回 404', async () => {
      ({ baseURL, cleanup } = await createTestServer());

      const res = await fetch(
        `${baseURL}/linforge/registry/nodes?graphSlug=nonexistent`,
      );
      expect(res.status).toBe(404);
    });
  });

  describe('GET /linforge/graph/:slug', () => {
    it('返回图定义', async () => {
      ({ baseURL, cleanup } = await createTestServer());

      const res = await fetch(`${baseURL}/linforge/graph/test-agent`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.slug).toBe('test-agent');
      expect(data.name).toBe('测试 Agent');
      expect(data.nodes).toHaveLength(3);
      expect(data.edges).toHaveLength(2);
    });

    it('不存在的 slug 返回 404', async () => {
      ({ baseURL, cleanup } = await createTestServer());

      const res = await fetch(`${baseURL}/linforge/graph/nonexistent`);
      expect(res.status).toBe(404);

      const data = await res.json();
      expect(data.error).toContain('not found');
    });
  });

  describe('POST /linforge/graph/:slug/run', () => {
    it('成功触发运行返回 202 + runId', async () => {
      const registry = new NodeRegistry();
      registry.register({
        key: 'planner',
        run: async (state: any) => state,
      });

      // mock compiler.compile 返回一个假的 Runnable
      const mockGraph = {
        invoke: vi.fn(async () => ({ done: true })),
      };
      const compiler = new GraphCompiler(registry);
      vi.spyOn(compiler, 'compile').mockReturnValue({
        graph: mockGraph as any,
        bindingStatus: { bound: ['planner'], skeleton: [] },
      });

      const graphStore = new MemoryGraphStore();
      graphStore.setGraph('test-agent', testGraphDef);

      const runManager = new RunManager();

      const app = new Koa();
      app.use(async (ctx, next) => {
        if (
          ctx.method === 'POST' ||
          ctx.method === 'PUT' ||
          ctx.method === 'PATCH'
        ) {
          const body = await new Promise<string>((resolve) => {
            let data = '';
            ctx.req.on('data', (chunk: Buffer) => (data += chunk.toString()));
            ctx.req.on('end', () => resolve(data));
          });
          try {
            (ctx.request as any).body = JSON.parse(body);
          } catch {
            (ctx.request as any).body = {};
          }
        }
        await next();
      });

      mountRoutes(app, {
        registry,
        compiler,
        graphStore,
        runManager,
        stateSchema: {},
      });

      const srv = createServer(app.callback());
      await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
      const addr = srv.address() as { port: number };
      const url = `http://127.0.0.1:${addr.port}`;

      try {
        const res = await fetch(`${url}/linforge/graph/test-agent/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instruction: '分析前端趋势' }),
        });

        expect(res.status).toBe(202);
        const data = await res.json();
        expect(data.runId).toBeDefined();
        expect(typeof data.runId).toBe('string');

        // 验证 compiler.compile 被调用
        expect(compiler.compile).toHaveBeenCalledOnce();

        // 等待 mock graph 执行完成
        await new Promise((r) => setTimeout(r, 50));
      } finally {
        await new Promise<void>((r) => srv.close(() => r()));
      }
    });

    it('缺少 instruction 返回 400', async () => {
      ({ baseURL, cleanup } = await createTestServer());

      const res = await fetch(`${baseURL}/linforge/graph/test-agent/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('instruction');
    });

    it('空字符串 instruction 返回 400', async () => {
      ({ baseURL, cleanup } = await createTestServer());

      const res = await fetch(`${baseURL}/linforge/graph/test-agent/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: '  ' }),
      });

      expect(res.status).toBe(400);
    });

    it('不存在的图 slug 返回 404', async () => {
      ({ baseURL, cleanup } = await createTestServer());

      const res = await fetch(`${baseURL}/linforge/graph/nonexistent/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: '测试' }),
      });

      expect(res.status).toBe(404);
    });

    it('配置 stepPersister 后自动传 stepRecording 给 compile', async () => {
      const registry = new NodeRegistry();
      registry.register({
        key: 'planner',
        run: async (state: any) => state,
      });

      const mockGraph = {
        invoke: vi.fn(async () => ({ done: true })),
      };
      const compiler = new GraphCompiler(registry);
      const compileSpy = vi.spyOn(compiler, 'compile').mockReturnValue({
        graph: mockGraph as any,
        bindingStatus: { bound: ['planner'], skeleton: [] },
      });

      const graphStore = new MemoryGraphStore();
      graphStore.setGraph('test-agent', testGraphDef);

      const stepPersister = new MemoryStepPersister();
      const runManager = new RunManager();

      const app = new Koa();
      app.use(async (ctx, next) => {
        if (
          ctx.method === 'POST' ||
          ctx.method === 'PUT' ||
          ctx.method === 'PATCH'
        ) {
          const body = await new Promise<string>((resolve) => {
            let data = '';
            ctx.req.on('data', (chunk: Buffer) => (data += chunk.toString()));
            ctx.req.on('end', () => resolve(data));
          });
          try {
            (ctx.request as any).body = JSON.parse(body);
          } catch {
            (ctx.request as any).body = {};
          }
        }
        await next();
      });

      mountRoutes(app, {
        registry,
        compiler,
        graphStore,
        runManager,
        stepPersister,
        stateSchema: {},
      });

      const srv = createServer(app.callback());
      await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
      const addr = srv.address() as { port: number };
      const url = `http://127.0.0.1:${addr.port}`;

      try {
        await fetch(`${url}/linforge/graph/test-agent/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instruction: '测试' }),
        });

        // 验证 compile 收到了 stepRecording 配置
        expect(compileSpy).toHaveBeenCalledOnce();
        const compileArgs = compileSpy.mock.calls[0][0];
        expect(compileArgs.stepRecording).toBeDefined();
        expect(compileArgs.stepRecording!.persister).toBe(stepPersister);
        expect(compileArgs.stepRecording!.debug).toBe(false);

        await new Promise((r) => setTimeout(r, 50));
      } finally {
        await new Promise<void>((r) => srv.close(() => r()));
      }
    });

    it('配置 stepPersister 后自动注入 agentRunId 到 input', async () => {
      const registry = new NodeRegistry();
      registry.register({
        key: 'planner',
        run: async (state: any) => state,
      });

      const mockGraph = {
        invoke: vi.fn(async () => ({ done: true })),
      };
      const compiler = new GraphCompiler(registry);
      vi.spyOn(compiler, 'compile').mockReturnValue({
        graph: mockGraph as any,
        bindingStatus: { bound: ['planner'], skeleton: [] },
      });

      const graphStore = new MemoryGraphStore();
      graphStore.setGraph('test-agent', testGraphDef);

      const stepPersister = new MemoryStepPersister();
      const runManager = new RunManager();

      const app = new Koa();
      app.use(async (ctx, next) => {
        if (
          ctx.method === 'POST' ||
          ctx.method === 'PUT' ||
          ctx.method === 'PATCH'
        ) {
          const body = await new Promise<string>((resolve) => {
            let data = '';
            ctx.req.on('data', (chunk: Buffer) => (data += chunk.toString()));
            ctx.req.on('end', () => resolve(data));
          });
          try {
            (ctx.request as any).body = JSON.parse(body);
          } catch {
            (ctx.request as any).body = {};
          }
        }
        await next();
      });

      mountRoutes(app, {
        registry,
        compiler,
        graphStore,
        runManager,
        stepPersister,
        stateSchema: {},
        buildInput: (instruction: string) => ({ msg: instruction }),
      });

      const srv = createServer(app.callback());
      await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
      const addr = srv.address() as { port: number };
      const url = `http://127.0.0.1:${addr.port}`;

      try {
        const res = await fetch(`${url}/linforge/graph/test-agent/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instruction: '分析趋势',
            runId: 'my-run-123',
          }),
        });

        expect(res.status).toBe(202);

        // 等待 invoke 被调用
        await new Promise((r) => setTimeout(r, 50));

        // 验证 graph.invoke 收到的 input 包含 agentRunId
        expect(mockGraph.invoke).toHaveBeenCalledOnce();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invokedInput = (
          mockGraph.invoke.mock.calls as any
        )[0][0] as Record<string, unknown>;
        expect(invokedInput.msg).toBe('分析趋势');
        expect(invokedInput.agentRunId).toBe('my-run-123');
      } finally {
        await new Promise<void>((r) => srv.close(() => r()));
      }
    });

    it('未配置 stepPersister 时不注入 agentRunId', async () => {
      const registry = new NodeRegistry();
      registry.register({
        key: 'planner',
        run: async (state: any) => state,
      });

      const mockGraph = {
        invoke: vi.fn(async () => ({ done: true })),
      };
      const compiler = new GraphCompiler(registry);
      vi.spyOn(compiler, 'compile').mockReturnValue({
        graph: mockGraph as any,
        bindingStatus: { bound: ['planner'], skeleton: [] },
      });

      const graphStore = new MemoryGraphStore();
      graphStore.setGraph('test-agent', testGraphDef);

      const runManager = new RunManager();

      const app = new Koa();
      app.use(async (ctx, next) => {
        if (
          ctx.method === 'POST' ||
          ctx.method === 'PUT' ||
          ctx.method === 'PATCH'
        ) {
          const body = await new Promise<string>((resolve) => {
            let data = '';
            ctx.req.on('data', (chunk: Buffer) => (data += chunk.toString()));
            ctx.req.on('end', () => resolve(data));
          });
          try {
            (ctx.request as any).body = JSON.parse(body);
          } catch {
            (ctx.request as any).body = {};
          }
        }
        await next();
      });

      mountRoutes(app, {
        registry,
        compiler,
        graphStore,
        runManager,
        stateSchema: {},
        buildInput: (instruction: string) => ({ msg: instruction }),
      });

      const srv = createServer(app.callback());
      await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
      const addr = srv.address() as { port: number };
      const url = `http://127.0.0.1:${addr.port}`;

      try {
        await fetch(`${url}/linforge/graph/test-agent/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instruction: '测试' }),
        });

        await new Promise((r) => setTimeout(r, 50));

        // 验证 input 没有 agentRunId
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invokedInput = (
          mockGraph.invoke.mock.calls as any
        )[0][0] as Record<string, unknown>;
        expect(invokedInput.msg).toBe('测试');
        expect(invokedInput.agentRunId).toBeUndefined();
      } finally {
        await new Promise<void>((r) => srv.close(() => r()));
      }
    });

    it('可指定自定义 runId', async () => {
      const registry = new NodeRegistry();
      registry.register({
        key: 'planner',
        run: async (state: any) => state,
      });

      const mockGraph = {
        invoke: vi.fn(async () => ({ done: true })),
      };
      const compiler = new GraphCompiler(registry);
      vi.spyOn(compiler, 'compile').mockReturnValue({
        graph: mockGraph as any,
        bindingStatus: { bound: ['planner'], skeleton: [] },
      });

      const graphStore = new MemoryGraphStore();
      graphStore.setGraph('test-agent', testGraphDef);

      const runManager = new RunManager();

      const app = new Koa();
      app.use(async (ctx, next) => {
        if (
          ctx.method === 'POST' ||
          ctx.method === 'PUT' ||
          ctx.method === 'PATCH'
        ) {
          const body = await new Promise<string>((resolve) => {
            let data = '';
            ctx.req.on('data', (chunk: Buffer) => (data += chunk.toString()));
            ctx.req.on('end', () => resolve(data));
          });
          try {
            (ctx.request as any).body = JSON.parse(body);
          } catch {
            (ctx.request as any).body = {};
          }
        }
        await next();
      });

      mountRoutes(app, {
        registry,
        compiler,
        graphStore,
        runManager,
        stateSchema: {},
      });

      const srv = createServer(app.callback());
      await new Promise<void>((r) => srv.listen(0, '127.0.0.1', r));
      const addr = srv.address() as { port: number };
      const url = `http://127.0.0.1:${addr.port}`;

      try {
        const res = await fetch(`${url}/linforge/graph/test-agent/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instruction: '分析前端趋势',
            runId: 'custom-run-id',
          }),
        });

        expect(res.status).toBe(202);
        const data = await res.json();
        expect(data.runId).toBe('custom-run-id');

        await new Promise((r) => setTimeout(r, 50));
      } finally {
        await new Promise<void>((r) => srv.close(() => r()));
      }
    });
  });

  describe('PUT /linforge/graph/:slug', () => {
    it('保存新图定义', async () => {
      ({ baseURL, cleanup } = await createTestServer());

      const res = await fetch(`${baseURL}/linforge/graph/new-graph`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: [
            { key: '__start__', label: '开始' },
            { key: '__end__', label: '结束' },
          ],
          edges: [{ source: '__start__', target: '__end__' }],
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.slug).toBe('new-graph');
      expect(data.nodes).toHaveLength(2);

      // 验证能通过 GET 读回
      const getRes = await fetch(`${baseURL}/linforge/graph/new-graph`);
      expect(getRes.status).toBe(200);
    });

    it('更新已有图定义，保留 id 和 name', async () => {
      ({ baseURL, cleanup } = await createTestServer());

      const res = await fetch(`${baseURL}/linforge/graph/test-agent`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: [
            { key: '__start__', label: '开始' },
            { key: 'newNode', label: '新节点' },
            { key: '__end__', label: '结束' },
          ],
          edges: [
            { source: '__start__', target: 'newNode' },
            { source: 'newNode', target: '__end__' },
          ],
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      // 保留原有 id 和 name
      expect(data.id).toBe('graph-1');
      expect(data.name).toBe('测试 Agent');
      expect(data.nodes).toHaveLength(3);
    });

    it('缺少 nodes 或 edges 返回 400', async () => {
      ({ baseURL, cleanup } = await createTestServer());

      const res = await fetch(`${baseURL}/linforge/graph/test-agent`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes: [] }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('arrays');
    });

    it('可指定自定义 name', async () => {
      ({ baseURL, cleanup } = await createTestServer());

      const res = await fetch(`${baseURL}/linforge/graph/new-graph`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '自定义名称',
          nodes: [{ key: '__start__', label: '开始' }],
          edges: [],
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe('自定义名称');
    });
  });

  describe('自定义前缀', () => {
    it('使用自定义 prefix', async () => {
      ({ baseURL, cleanup } = await createTestServer({
        prefix: '/api/agent',
      }));

      const res = await fetch(`${baseURL}/api/agent/registry/nodes`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.nodes).toBeDefined();
    });
  });

  describe('GET /linforge/templates', () => {
    it('无 templateRegistry 时返回空列表', async () => {
      ({ baseURL, cleanup } = await createTestServer());

      const res = await fetch(`${baseURL}/linforge/templates`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.templates).toEqual([]);
    });

    it('有 templateRegistry 时返回模板列表', async () => {
      const templateRegistry = new TemplateRegistry();
      templateRegistry.registerAll(builtinTemplates);

      ({ baseURL, cleanup } = await createTestServer({ templateRegistry }));

      const res = await fetch(`${baseURL}/linforge/templates`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.templates).toHaveLength(4);
      expect(data.templates[0].id).toBe('react-agent');
      expect(data.templates[0].name).toBeDefined();
      expect(data.templates[0].nodes).toBeDefined();
    });
  });

  describe('POST /linforge/graph/:slug/apply-template', () => {
    it('应用模板到已有图', async () => {
      const templateRegistry = new TemplateRegistry();
      templateRegistry.registerAll(builtinTemplates);

      ({ baseURL, cleanup } = await createTestServer({ templateRegistry }));

      const res = await fetch(
        `${baseURL}/linforge/graph/test-agent/apply-template`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateId: 'pipeline' }),
        },
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      // 原有 3 个节点 + pipeline 4 个节点
      expect(data.nodes.length).toBeGreaterThan(3);
      expect(data.skeletonKeys).toBeDefined();
      expect(data.renamedKeys).toBeDefined();
    });

    it('应用模板到不存在的图（自动创建空图）', async () => {
      const templateRegistry = new TemplateRegistry();
      templateRegistry.registerAll(builtinTemplates);

      ({ baseURL, cleanup } = await createTestServer({ templateRegistry }));

      const res = await fetch(
        `${baseURL}/linforge/graph/brand-new/apply-template`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateId: 'pipeline' }),
        },
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.slug).toBe('brand-new');
      // __start__ + __end__ + pipeline 4 个节点
      expect(data.nodes).toHaveLength(6);
    });

    it('缺少 templateId 返回 400', async () => {
      const templateRegistry = new TemplateRegistry();

      ({ baseURL, cleanup } = await createTestServer({ templateRegistry }));

      const res = await fetch(
        `${baseURL}/linforge/graph/test-agent/apply-template`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('templateId');
    });

    it('不存在的模板返回 404', async () => {
      const templateRegistry = new TemplateRegistry();

      ({ baseURL, cleanup } = await createTestServer({ templateRegistry }));

      const res = await fetch(
        `${baseURL}/linforge/graph/test-agent/apply-template`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateId: 'nonexistent' }),
        },
      );

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toContain('not found');
    });

    it('未配置 templateRegistry 返回 400', async () => {
      ({ baseURL, cleanup } = await createTestServer());

      const res = await fetch(
        `${baseURL}/linforge/graph/test-agent/apply-template`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateId: 'pipeline' }),
        },
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('not configured');
    });

    it('应用模板后图已持久化到 GraphStore', async () => {
      const templateRegistry = new TemplateRegistry();
      templateRegistry.registerAll(builtinTemplates);

      ({ baseURL, cleanup } = await createTestServer({ templateRegistry }));

      await fetch(`${baseURL}/linforge/graph/test-agent/apply-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: 'pipeline' }),
      });

      // 通过 GET 验证已持久化
      const getRes = await fetch(`${baseURL}/linforge/graph/test-agent`);
      const data = await getRes.json();
      expect(data.nodes.length).toBeGreaterThan(3);
    });

    it('key 冲突时返回 renamedKeys', async () => {
      const templateRegistry = new TemplateRegistry();
      templateRegistry.register({
        id: 'conflict-test',
        name: '冲突测试',
        description: '测试',
        nodes: [{ key: 'planner', label: '冲突的 Planner' }],
        edges: [],
      });

      ({ baseURL, cleanup } = await createTestServer({ templateRegistry }));

      const res = await fetch(
        `${baseURL}/linforge/graph/test-agent/apply-template`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateId: 'conflict-test' }),
        },
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.renamedKeys.planner).toBe('planner_2');
    });
  });

  describe('GET /linforge/graph/:slug/runs', () => {
    it('返回运行历史列表', async () => {
      const runStore = new MemoryRunStore();
      await runStore.createRun({
        id: 'run-1',
        graphSlug: 'test-agent',
        status: 'completed',
        input: { instruction: '测试' },
        tokensUsed: 500,
        startedAt: new Date('2026-02-23T10:00:00Z'),
      });
      await runStore.createRun({
        id: 'run-2',
        graphSlug: 'test-agent',
        status: 'running',
        input: { instruction: '测试 2' },
        tokensUsed: 0,
        startedAt: new Date('2026-02-23T11:00:00Z'),
      });

      ({ baseURL, cleanup } = await createTestServer({ runStore }));

      const res = await fetch(`${baseURL}/linforge/graph/test-agent/runs`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.runs).toHaveLength(2);
      // 按 startedAt 倒序
      expect(data.runs[0].id).toBe('run-2');
      expect(data.runs[1].id).toBe('run-1');
    });

    it('分页参数生效', async () => {
      const runStore = new MemoryRunStore();
      for (let i = 1; i <= 5; i++) {
        await runStore.createRun({
          id: `run-${i}`,
          graphSlug: 'test-agent',
          status: 'completed',
          tokensUsed: 0,
          startedAt: new Date(`2026-02-23T${10 + i}:00:00Z`),
        });
      }

      ({ baseURL, cleanup } = await createTestServer({ runStore }));

      const res = await fetch(
        `${baseURL}/linforge/graph/test-agent/runs?limit=2&offset=1`,
      );
      const data = await res.json();
      expect(data.runs).toHaveLength(2);
      // 倒序后 offset=1 跳过最新的 run-5
      expect(data.runs[0].id).toBe('run-4');
      expect(data.runs[1].id).toBe('run-3');
    });

    it('不同 graphSlug 不混淆', async () => {
      const runStore = new MemoryRunStore();
      await runStore.createRun({
        id: 'run-a',
        graphSlug: 'test-agent',
        status: 'completed',
        tokensUsed: 0,
        startedAt: new Date(),
      });
      await runStore.createRun({
        id: 'run-b',
        graphSlug: 'other-graph',
        status: 'completed',
        tokensUsed: 0,
        startedAt: new Date(),
      });

      ({ baseURL, cleanup } = await createTestServer({ runStore }));

      const res = await fetch(`${baseURL}/linforge/graph/test-agent/runs`);
      const data = await res.json();
      expect(data.runs).toHaveLength(1);
      expect(data.runs[0].id).toBe('run-a');
    });

    it('未配置 RunStore 返回 501', async () => {
      ({ baseURL, cleanup } = await createTestServer());

      const res = await fetch(`${baseURL}/linforge/graph/test-agent/runs`);
      expect(res.status).toBe(501);
    });
  });

  describe('GET /linforge/runs/:runId', () => {
    it('返回运行详情', async () => {
      const runStore = new MemoryRunStore();
      await runStore.createRun({
        id: 'run-detail',
        graphSlug: 'test-agent',
        status: 'completed',
        input: { instruction: '分析趋势' },
        tokensUsed: 1200,
        startedAt: new Date('2026-02-23T10:00:00Z'),
      });
      await runStore.updateRunStatus('run-detail', 'completed', {
        topics: 3,
      });

      ({ baseURL, cleanup } = await createTestServer({ runStore }));

      const res = await fetch(`${baseURL}/linforge/runs/run-detail`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.id).toBe('run-detail');
      expect(data.graphSlug).toBe('test-agent');
      expect(data.status).toBe('completed');
      expect(data.result).toMatchObject({ topics: 3 });
    });

    it('不存在的 runId 返回 404', async () => {
      const runStore = new MemoryRunStore();
      ({ baseURL, cleanup } = await createTestServer({ runStore }));

      const res = await fetch(`${baseURL}/linforge/runs/nonexistent`);
      expect(res.status).toBe(404);
    });

    it('未配置 RunStore 返回 501', async () => {
      ({ baseURL, cleanup } = await createTestServer());

      const res = await fetch(`${baseURL}/linforge/runs/any-id`);
      expect(res.status).toBe(501);
    });
  });

  describe('GET /linforge/runs/:runId/steps', () => {
    it('返回步骤列表', async () => {
      const stepPersister = new MemoryStepPersister();
      await stepPersister.createStep({
        agentRunId: 'run-steps',
        nodeId: 'planner',
        stepNumber: 1,
        input: {},
        output: { plan: '采集数据' },
        durationMs: 120,
        tokensUsed: 300,
      });
      await stepPersister.createStep({
        agentRunId: 'run-steps',
        nodeId: 'tools',
        stepNumber: 2,
        input: {},
        output: { items: 5 },
        durationMs: 2000,
        tokensUsed: 0,
        toolName: 'fetchDevto',
      });

      ({ baseURL, cleanup } = await createTestServer({ stepPersister }));

      const res = await fetch(`${baseURL}/linforge/runs/run-steps/steps`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.steps).toHaveLength(2);
      expect(data.steps[0].nodeId).toBe('planner');
      expect(data.steps[1].toolName).toBe('fetchDevto');
    });

    it('无步骤时返回空数组', async () => {
      const stepPersister = new MemoryStepPersister();
      ({ baseURL, cleanup } = await createTestServer({ stepPersister }));

      const res = await fetch(`${baseURL}/linforge/runs/nonexistent/steps`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.steps).toEqual([]);
    });

    it('未配置 StepPersister 返回 501', async () => {
      ({ baseURL, cleanup } = await createTestServer());

      const res = await fetch(`${baseURL}/linforge/runs/any-id/steps`);
      expect(res.status).toBe(501);
    });

    it('默认不返回 stateBefore/stateAfter', async () => {
      const stepPersister = new MemoryStepPersister();
      await stepPersister.createStep({
        agentRunId: 'run-snap',
        nodeId: 'planner',
        stepNumber: 1,
        input: { iteration: 1 },
        output: { plan: 'test' },
        durationMs: 100,
        tokensUsed: 50,
        stateBefore: { iteration: 0, tokensUsed: 0 },
        stateAfter: { iteration: 1, tokensUsed: 50 },
      });

      ({ baseURL, cleanup } = await createTestServer({ stepPersister }));

      const res = await fetch(`${baseURL}/linforge/runs/run-snap/steps`);
      const data = await res.json();
      expect(data.steps[0].stateBefore).toBeUndefined();
      expect(data.steps[0].stateAfter).toBeUndefined();
      expect(data.steps[0].nodeId).toBe('planner');
    });

    it('includeSnapshots=true 返回快照字段', async () => {
      const stepPersister = new MemoryStepPersister();
      await stepPersister.createStep({
        agentRunId: 'run-snap-2',
        nodeId: 'analyzer',
        stepNumber: 1,
        input: {},
        output: { count: 5 },
        durationMs: 200,
        tokensUsed: 100,
        stateBefore: { items: [1, 2], iteration: 2 },
        stateAfter: { items: [1, 2], iteration: 2, analyzedCount: 5 },
      });

      ({ baseURL, cleanup } = await createTestServer({ stepPersister }));

      const res = await fetch(
        `${baseURL}/linforge/runs/run-snap-2/steps?includeSnapshots=true`,
      );
      const data = await res.json();
      expect(data.steps[0].stateBefore).toEqual({
        items: [1, 2],
        iteration: 2,
      });
      expect(data.steps[0].stateAfter).toEqual({
        items: [1, 2],
        iteration: 2,
        analyzedCount: 5,
      });
    });
  });

  describe('Prompt 路由', () => {
    describe('GET /linforge/prompts/:nodeId', () => {
      it('返回版本列表（desc）', async () => {
        const promptStore = new MemoryPromptStore();
        await promptStore.createVersion('planner', { template: 'v1' });
        await promptStore.createVersion('planner', {
          template: 'v2',
          temperature: 0.5,
        });

        ({ baseURL, cleanup } = await createTestServer({ promptStore }));

        const res = await fetch(`${baseURL}/linforge/prompts/planner`);
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data.versions).toHaveLength(2);
        // desc 排序：最新版本在前
        expect(data.versions[0].version).toBe(2);
        expect(data.versions[0].template).toBe('v2');
        expect(data.versions[1].version).toBe(1);
      });

      it('无版本时返回空数组', async () => {
        const promptStore = new MemoryPromptStore();
        ({ baseURL, cleanup } = await createTestServer({ promptStore }));

        const res = await fetch(`${baseURL}/linforge/prompts/unknown`);
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data.versions).toEqual([]);
      });

      it('未配置 PromptStore 返回 501', async () => {
        ({ baseURL, cleanup } = await createTestServer());

        const res = await fetch(`${baseURL}/linforge/prompts/planner`);
        expect(res.status).toBe(501);
      });
    });

    describe('GET /linforge/prompts/:nodeId/active', () => {
      it('返回活跃版本', async () => {
        const promptStore = new MemoryPromptStore();
        const v = await promptStore.createVersion('planner', {
          template: 'active template',
          temperature: 0.7,
        });
        await promptStore.activateVersion('planner', v.id);

        ({ baseURL, cleanup } = await createTestServer({ promptStore }));

        const res = await fetch(`${baseURL}/linforge/prompts/planner/active`);
        expect(res.status).toBe(200);

        const data = await res.json();
        expect(data.template).toBe('active template');
        expect(data.temperature).toBe(0.7);
        expect(data.isActive).toBe(true);
        expect(data.nodeId).toBe('planner');
      });

      it('无活跃版本返回 404', async () => {
        const promptStore = new MemoryPromptStore();
        await promptStore.createVersion('planner', { template: 'not active' });

        ({ baseURL, cleanup } = await createTestServer({ promptStore }));

        const res = await fetch(`${baseURL}/linforge/prompts/planner/active`);
        expect(res.status).toBe(404);
      });

      it('未配置 PromptStore 返回 501', async () => {
        ({ baseURL, cleanup } = await createTestServer());

        const res = await fetch(`${baseURL}/linforge/prompts/planner/active`);
        expect(res.status).toBe(501);
      });
    });

    describe('POST /linforge/prompts/:nodeId', () => {
      it('创建新版本', async () => {
        const promptStore = new MemoryPromptStore();
        ({ baseURL, cleanup } = await createTestServer({ promptStore }));

        const res = await fetch(`${baseURL}/linforge/prompts/analyzer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            template: '分析内容...',
            temperature: 0.5,
          }),
        });

        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data.nodeId).toBe('analyzer');
        expect(data.version).toBe(1);
        expect(data.template).toBe('分析内容...');
        expect(data.temperature).toBe(0.5);
        expect(data.isActive).toBe(false);
      });

      it('默认 temperature 0.3', async () => {
        const promptStore = new MemoryPromptStore();
        ({ baseURL, cleanup } = await createTestServer({ promptStore }));

        const res = await fetch(`${baseURL}/linforge/prompts/planner`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ template: '规划...' }),
        });

        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data.temperature).toBe(0.3);
      });

      it('缺少 template 返回 400', async () => {
        const promptStore = new MemoryPromptStore();
        ({ baseURL, cleanup } = await createTestServer({ promptStore }));

        const res = await fetch(`${baseURL}/linforge/prompts/planner`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ temperature: 0.5 }),
        });

        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toContain('template');
      });

      it('空 template 返回 400', async () => {
        const promptStore = new MemoryPromptStore();
        ({ baseURL, cleanup } = await createTestServer({ promptStore }));

        const res = await fetch(`${baseURL}/linforge/prompts/planner`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ template: '   ' }),
        });

        expect(res.status).toBe(400);
      });

      it('未配置 PromptStore 返回 501', async () => {
        ({ baseURL, cleanup } = await createTestServer());

        const res = await fetch(`${baseURL}/linforge/prompts/planner`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ template: 'test' }),
        });

        expect(res.status).toBe(501);
      });
    });

    describe('POST /linforge/prompts/:nodeId/versions/:id/activate', () => {
      it('激活指定版本', async () => {
        const promptStore = new MemoryPromptStore();
        const v1 = await promptStore.createVersion('planner', {
          template: 'v1',
        });
        const v2 = await promptStore.createVersion('planner', {
          template: 'v2',
        });
        await promptStore.activateVersion('planner', v1.id);

        ({ baseURL, cleanup } = await createTestServer({ promptStore }));

        // 激活 v2
        const res = await fetch(
          `${baseURL}/linforge/prompts/planner/versions/${v2.id}/activate`,
          { method: 'POST' },
        );

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.ok).toBe(true);

        // 验证 v2 已激活
        const activeRes = await fetch(
          `${baseURL}/linforge/prompts/planner/active`,
        );
        const activeData = await activeRes.json();
        expect(activeData.id).toBe(v2.id);
        expect(activeData.template).toBe('v2');
      });

      it('未配置 PromptStore 返回 501', async () => {
        ({ baseURL, cleanup } = await createTestServer());

        const res = await fetch(
          `${baseURL}/linforge/prompts/planner/versions/fake/activate`,
          { method: 'POST' },
        );

        expect(res.status).toBe(501);
      });
    });
  });

  describe('POST /linforge/graphs', () => {
    it('成功创建新图', async () => {
      ({ baseURL, cleanup } = await createTestServer());

      const res = await fetch(`${baseURL}/linforge/graphs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '新 Agent',
          slug: 'new-agent',
          icon: 'zap',
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.slug).toBe('new-agent');
      expect(data.name).toBe('新 Agent');
      expect(data.icon).toBe('zap');
      // 自动创建 __start__ + __end__
      expect(data.nodes).toHaveLength(2);
      expect(data.nodes[0].key).toBe('__start__');
      expect(data.nodes[1].key).toBe('__end__');
      expect(data.edges).toEqual([]);

      // 通过 GET 验证已持久化
      const getRes = await fetch(`${baseURL}/linforge/graph/new-agent`);
      expect(getRes.status).toBe(200);
    });

    it('slug 已存在返回 409', async () => {
      ({ baseURL, cleanup } = await createTestServer());

      const res = await fetch(`${baseURL}/linforge/graphs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '重复', slug: 'test-agent' }),
      });

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toContain('already exists');
    });

    it('slug 格式无效返回 400', async () => {
      ({ baseURL, cleanup } = await createTestServer());

      const res = await fetch(`${baseURL}/linforge/graphs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '测试', slug: 'INVALID_Slug!' }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('slug');
    });

    it('缺少必填字段返回 400', async () => {
      ({ baseURL, cleanup } = await createTestServer());

      const res = await fetch(`${baseURL}/linforge/graphs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '只有名字' }),
      });

      expect(res.status).toBe(400);
    });

    it('GET /graphs 返回 icon', async () => {
      ({ baseURL, cleanup } = await createTestServer());

      // 先创建带 icon 的图
      await fetch(`${baseURL}/linforge/graphs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'With Icon',
          slug: 'icon-test',
          icon: 'lightbulb',
        }),
      });

      const res = await fetch(`${baseURL}/linforge/graphs`);
      const data = await res.json();
      const iconGraph = data.graphs.find((g: any) => g.slug === 'icon-test');
      expect(iconGraph).toBeDefined();
      expect(iconGraph.icon).toBe('lightbulb');
    });
  });

  describe('PATCH /linforge/graphs/:slug', () => {
    it('成功修改名称和图标', async () => {
      ({ baseURL, cleanup } = await createTestServer());

      const res = await fetch(`${baseURL}/linforge/graphs/test-agent`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '新名称', icon: 'edit' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe('新名称');
      expect(data.icon).toBe('edit');
      // nodes/edges 不受影响
      expect(data.nodes).toHaveLength(3);
      expect(data.edges).toHaveLength(2);
    });

    it('不存在的 slug 返回 404', async () => {
      ({ baseURL, cleanup } = await createTestServer());

      const res = await fetch(`${baseURL}/linforge/graphs/nonexistent`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '测试' }),
      });

      expect(res.status).toBe(404);
    });

    it('只修改 name，不影响其他字段', async () => {
      ({ baseURL, cleanup } = await createTestServer());

      const res = await fetch(`${baseURL}/linforge/graphs/test-agent`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '只改名' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe('只改名');
      expect(data.slug).toBe('test-agent');
    });
  });
});
