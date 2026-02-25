import { describe, it, expect, afterEach } from 'vitest';
import Koa from 'koa';
import { createServer } from 'node:http';
import { StateSchema } from '@langchain/langgraph';
import { z } from 'zod/v4';
import { defineNode } from '../core/defineNode';
import { linforgeMiddleware } from '../server/middleware';
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
      { key: 'echo', label: 'echo', routeKeys: [] },
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
