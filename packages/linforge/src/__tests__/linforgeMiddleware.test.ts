import { describe, it, expect, afterEach } from 'vitest';
import Koa from 'koa';
import { createServer } from 'node:http';
import { StateSchema } from '@langchain/langgraph';
import { z } from 'zod/v4';
import { defineNode } from '../core/defineNode';
import { linforgeMiddleware } from '../server/middleware';
import type { LinforgeMiddlewareOptions } from '../server/middleware';
import { MemoryGraphStore } from '../testing/MemoryGraphStore';
import type { GraphDefinition } from '../core/types';

// ============================================================
// 辅助工具
// ============================================================

// 简单 bodyParser 中间件（测试用）
const bodyParser: Koa.Middleware = async (ctx, next) => {
  if (ctx.method === 'POST' || ctx.method === 'PUT' || ctx.method === 'PATCH') {
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
};

// 测试用 node
const echoNode = defineNode({
  key: 'echo',
  label: 'Echo',
  run: async (state: any) => state,
});

// 测试用图定义
const testGraphDef: GraphDefinition = {
  id: 'graph-1',
  slug: 'test-agent',
  name: '测试 Agent',
  nodes: [
    { key: '__start__', label: '开始' },
    { key: 'echo', label: 'Echo' },
    { key: '__end__', label: '结束' },
  ],
  edges: [
    { source: '__start__', target: 'echo' },
    { source: 'echo', target: '__end__' },
  ],
};

// 启动测试服务器
async function createTestServer(
  middlewareOptions: Parameters<typeof linforgeMiddleware>[0],
  preMiddleware?: Koa.Middleware,
): Promise<{ baseURL: string; cleanup: () => Promise<void> }> {
  const app = new Koa();
  app.use(bodyParser);
  if (preMiddleware) app.use(preMiddleware);
  app.use(linforgeMiddleware(middlewareOptions));

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

// ============================================================
// 测试
// ============================================================

describe('linforgeMiddleware', () => {
  let baseURL: string;
  let cleanup: () => Promise<void>;

  afterEach(async () => {
    if (cleanup) await cleanup();
  });

  it('最小配置：stateSchema + nodes，路由可用', async () => {
    const stateSchema = new StateSchema({
      messages: z.array(z.string()).default([]),
    });

    ({ baseURL, cleanup } = await createTestServer({
      stateSchema,
      nodes: [echoNode],
    }));

    // 注册节点应包含 echo
    const res = await fetch(`${baseURL}/linforge/registry/nodes`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.nodes).toEqual([
      { key: 'echo', label: 'Echo', routeKeys: [] },
    ]);
  });

  it('自动注入 agentRunId：schema 未定义 agentRunId 时不报错', async () => {
    // 不包含 agentRunId 的 schema
    const stateSchema = new StateSchema({
      value: z.string().default(''),
    });

    // 不应抛异常
    ({ baseURL, cleanup } = await createTestServer({
      stateSchema,
      nodes: [echoNode],
    }));

    const res = await fetch(`${baseURL}/linforge/registry/nodes`);
    expect(res.status).toBe(200);
  });

  it('schema 已有 agentRunId 时不重复注入', async () => {
    const stateSchema = new StateSchema({
      messages: z.array(z.string()).default([]),
      agentRunId: z.string().default(''),
    });

    // 不应抛异常
    ({ baseURL, cleanup } = await createTestServer({
      stateSchema,
      nodes: [echoNode],
    }));

    const res = await fetch(`${baseURL}/linforge/registry/nodes`);
    expect(res.status).toBe(200);
  });

  it('自定义 prefix', async () => {
    const stateSchema = new StateSchema({
      value: z.string().default(''),
    });

    ({ baseURL, cleanup } = await createTestServer({
      stateSchema,
      nodes: [echoNode],
      prefix: '/api/lf',
    }));

    // 自定义前缀应该生效
    const res = await fetch(`${baseURL}/api/lf/registry/nodes`);
    expect(res.status).toBe(200);

    // 默认前缀应该 404
    const res2 = await fetch(`${baseURL}/linforge/registry/nodes`);
    expect(res2.status).toBe(404);
  });

  it('自定义 graphStore 被使用', async () => {
    const stateSchema = new StateSchema({
      value: z.string().default(''),
    });

    const customGraphStore = new MemoryGraphStore();
    customGraphStore.setGraph('test-agent', testGraphDef);

    ({ baseURL, cleanup } = await createTestServer({
      stateSchema,
      nodes: [echoNode],
      stores: { graphStore: customGraphStore },
    }));

    // 自定义 store 中的图应该可查到
    const res = await fetch(`${baseURL}/linforge/graph/test-agent`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.slug).toBe('test-agent');
  });

  it('默认包含内置模板', async () => {
    const stateSchema = new StateSchema({
      value: z.string().default(''),
    });

    ({ baseURL, cleanup } = await createTestServer({
      stateSchema,
      nodes: [echoNode],
    }));

    const res = await fetch(`${baseURL}/linforge/templates`);
    expect(res.status).toBe(200);
    const data = await res.json();
    // 内置模板应该存在
    expect(data.templates.length).toBeGreaterThan(0);
  });

  it('disableBuiltinTemplates 禁用内置模板', async () => {
    const stateSchema = new StateSchema({
      value: z.string().default(''),
    });

    ({ baseURL, cleanup } = await createTestServer({
      stateSchema,
      nodes: [echoNode],
      disableBuiltinTemplates: true,
    }));

    const res = await fetch(`${baseURL}/linforge/templates`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.templates).toEqual([]);
  });

  it('自定义 templates 追加到内置模板', async () => {
    const stateSchema = new StateSchema({
      value: z.string().default(''),
    });

    const customTemplate = {
      id: 'custom-tpl',
      name: '自定义模板',
      description: '测试用',
      nodes: [{ key: 'a', label: 'A' }],
      edges: [],
    };

    ({ baseURL, cleanup } = await createTestServer({
      stateSchema,
      nodes: [echoNode],
      templates: [customTemplate],
    }));

    const res = await fetch(`${baseURL}/linforge/templates`);
    const data = await res.json();
    const ids = data.templates.map((t: any) => t.id);
    expect(ids).toContain('custom-tpl');
  });

  it('多个 nodes 全部注册', async () => {
    const stateSchema = new StateSchema({
      value: z.string().default(''),
    });

    const nodeA = defineNode({ key: 'a', run: async (s: any) => s });
    const nodeB = defineNode({ key: 'b', run: async (s: any) => s });
    const nodeC = defineNode({ key: 'c', run: async (s: any) => s });

    ({ baseURL, cleanup } = await createTestServer({
      stateSchema,
      nodes: [nodeA, nodeB, nodeC],
    }));

    const res = await fetch(`${baseURL}/linforge/registry/nodes`);
    const data = await res.json();
    const keys = data.nodes.map((n: any) => n.key);
    expect(keys).toEqual(['a', 'b', 'c']);
  });
});

// ============================================================
// 多 Agent 模式测试
// ============================================================

describe('linforgeMiddleware — 多 Agent 模式', () => {
  let baseURL: string;
  let cleanup: () => Promise<void>;

  afterEach(async () => {
    if (cleanup) await cleanup();
  });

  const qaSchema = new StateSchema({
    question: z.string().default(''),
  });

  const coderSchema = new StateSchema({
    code: z.string().default(''),
  });

  const qaNode = defineNode({ key: 'retriever', run: async (s: any) => s });
  const coderNode = defineNode({ key: 'coder', run: async (s: any) => s });
  const sharedNode = defineNode({ key: 'logger', run: async (s: any) => s });

  it('不同 slug 返回各自的 registry 节点', async () => {
    ({ baseURL, cleanup } = await createTestServer({
      agents: [
        { slug: 'qa-bot', name: 'QA Bot', stateSchema: qaSchema, nodes: [qaNode] },
        { slug: 'coder', name: 'Coder', stateSchema: coderSchema, nodes: [coderNode] },
      ],
    }));

    // qa-bot 的节点
    const res1 = await fetch(`${baseURL}/linforge/registry/nodes?graphSlug=qa-bot`);
    const data1 = await res1.json();
    const keys1 = data1.nodes.map((n: any) => n.key);
    expect(keys1).toContain('retriever');
    expect(keys1).not.toContain('coder');

    // coder 的节点
    const res2 = await fetch(`${baseURL}/linforge/registry/nodes?graphSlug=coder`);
    const data2 = await res2.json();
    const keys2 = data2.nodes.map((n: any) => n.key);
    expect(keys2).toContain('coder');
    expect(keys2).not.toContain('retriever');
  });

  it('sharedNodes 对所有 agent 可见', async () => {
    ({ baseURL, cleanup } = await createTestServer({
      agents: [
        { slug: 'qa-bot', name: 'QA Bot', stateSchema: qaSchema, nodes: [qaNode] },
        { slug: 'coder', name: 'Coder', stateSchema: coderSchema, nodes: [coderNode] },
      ],
      sharedNodes: [sharedNode],
    }));

    const res1 = await fetch(`${baseURL}/linforge/registry/nodes?graphSlug=qa-bot`);
    const data1 = await res1.json();
    expect(data1.nodes.map((n: any) => n.key)).toContain('logger');

    const res2 = await fetch(`${baseURL}/linforge/registry/nodes?graphSlug=coder`);
    const data2 = await res2.json();
    expect(data2.nodes.map((n: any) => n.key)).toContain('logger');
  });

  it('slug 冲突检测抛错', () => {
    expect(() =>
      linforgeMiddleware({
        agents: [
          { slug: 'dup', name: 'A', stateSchema: qaSchema, nodes: [qaNode] },
          { slug: 'dup', name: 'B', stateSchema: coderSchema, nodes: [coderNode] },
        ],
      }),
    ).toThrow('重复的 slug');
  });

  it('启动时自动同步 GraphStore：不存在则创建', async () => {
    const customGraphStore = new MemoryGraphStore();

    ({ baseURL, cleanup } = await createTestServer({
      agents: [
        { slug: 'qa-bot', name: 'QA Bot', stateSchema: qaSchema, nodes: [qaNode] },
      ],
      stores: { graphStore: customGraphStore },
    }));

    // 触发一次请求以激活 lazy sync
    await fetch(`${baseURL}/linforge/graphs`);

    // 应该自动创建了 qa-bot 的图
    const res = await fetch(`${baseURL}/linforge/graph/qa-bot`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.slug).toBe('qa-bot');
    expect(data.name).toBe('QA Bot');
  });

  it('启动时自动同步 GraphStore：已存在则保留', async () => {
    const customGraphStore = new MemoryGraphStore();
    // 预设一个已有拓扑
    const existingGraph: GraphDefinition = {
      id: 'qa-bot',
      slug: 'qa-bot',
      name: '用户自定义名称',
      nodes: [
        { key: '__start__', label: '开始' },
        { key: 'retriever', label: '检索器' },
        { key: '__end__', label: '结束' },
      ],
      edges: [
        { source: '__start__', target: 'retriever' },
        { source: 'retriever', target: '__end__' },
      ],
    };
    customGraphStore.setGraph('qa-bot', existingGraph);

    ({ baseURL, cleanup } = await createTestServer({
      agents: [
        { slug: 'qa-bot', name: 'QA Bot', stateSchema: qaSchema, nodes: [qaNode] },
      ],
      stores: { graphStore: customGraphStore },
    }));

    // 触发一次请求以激活 lazy sync
    await fetch(`${baseURL}/linforge/graphs`);

    const res = await fetch(`${baseURL}/linforge/graph/qa-bot`);
    const data = await res.json();
    // 保留用户自定义名称而非 AgentConfig 中的 name
    expect(data.name).toBe('用户自定义名称');
    // 保留用户编辑的节点
    expect(data.nodes.length).toBe(3);
  });

  it('未配置 slug 的 graph 返回 404', async () => {
    ({ baseURL, cleanup } = await createTestServer({
      agents: [
        { slug: 'qa-bot', name: 'QA Bot', stateSchema: qaSchema, nodes: [qaNode] },
      ],
    }));

    // 触发 sync
    await fetch(`${baseURL}/linforge/graphs`);

    const res = await fetch(`${baseURL}/linforge/graph/unknown-agent`);
    expect(res.status).toBe(404);
  });

  it('不同 agent 同名节点互不干扰', async () => {
    // 两个 agent 都有名为 "worker" 的节点，但实现不同
    const workerA = defineNode({ key: 'worker', label: 'Worker-A', run: async (s: any) => s });
    const workerB = defineNode({ key: 'worker', label: 'Worker-B', run: async (s: any) => s });

    ({ baseURL, cleanup } = await createTestServer({
      agents: [
        { slug: 'agent-a', name: 'Agent A', stateSchema: qaSchema, nodes: [workerA] },
        { slug: 'agent-b', name: 'Agent B', stateSchema: coderSchema, nodes: [workerB] },
      ],
    }));

    // 各自的 registry 节点应该分别独立
    const res1 = await fetch(`${baseURL}/linforge/registry/nodes?graphSlug=agent-a`);
    const data1 = await res1.json();
    expect(data1.nodes.find((n: any) => n.key === 'worker')?.label).toBe('Worker-A');

    const res2 = await fetch(`${baseURL}/linforge/registry/nodes?graphSlug=agent-b`);
    const data2 = await res2.json();
    expect(data2.nodes.find((n: any) => n.key === 'worker')?.label).toBe('Worker-B');
  });

  it('GET /graphs 返回 codeFirst: true', async () => {
    ({ baseURL, cleanup } = await createTestServer({
      agents: [
        { slug: 'qa-bot', name: 'QA Bot', stateSchema: qaSchema, nodes: [qaNode] },
      ],
    }));

    const res = await fetch(`${baseURL}/linforge/graphs`);
    const data = await res.json();
    expect(data.codeFirst).toBe(true);
  });

  it('code-first 模式下 POST /graphs 返回 403', async () => {
    ({ baseURL, cleanup } = await createTestServer({
      agents: [
        { slug: 'qa-bot', name: 'QA Bot', stateSchema: qaSchema, nodes: [qaNode] },
      ],
    }));

    const res = await fetch(`${baseURL}/linforge/graphs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Agent', slug: 'new-agent' }),
    });
    expect(res.status).toBe(403);
  });

  it('单 Agent 模式向后兼容：GET /graphs 返回 codeFirst: false', async () => {
    const stateSchema = new StateSchema({
      value: z.string().default(''),
    });

    ({ baseURL, cleanup } = await createTestServer({
      stateSchema,
      nodes: [echoNode],
    }));

    const res = await fetch(`${baseURL}/linforge/graphs`);
    const data = await res.json();
    expect(data.codeFirst).toBe(false);
  });
});
