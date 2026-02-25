import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { GraphDefinition } from 'linforge/core';
import { PrismaGraphStore } from '../PrismaGraphStore';
import { createTestPrisma, cleanDatabase } from './helpers';

const prisma = createTestPrisma();
let store: PrismaGraphStore;

const sampleGraph: GraphDefinition = {
  id: 'g1',
  slug: 'test-graph',
  name: '测试图',
  icon: 'brain',
  nodes: [{ key: 'planner', label: 'Planner' }],
  edges: [{ source: 'planner', target: 'tools' }],
};

beforeAll(async () => {
  store = new PrismaGraphStore(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await cleanDatabase(prisma);
});

describe('PrismaGraphStore', () => {
  it('saveGraph + getGraph 基本 CRUD', async () => {
    await store.saveGraph(sampleGraph);
    const result = await store.getGraph('test-graph');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('g1');
    expect(result!.name).toBe('测试图');
    expect(result!.icon).toBe('brain');
    expect(result!.nodes).toEqual(sampleGraph.nodes);
    expect(result!.edges).toEqual(sampleGraph.edges);
  });

  it('getGraph 不存在返回 null', async () => {
    const result = await store.getGraph('nonexistent');
    expect(result).toBeNull();
  });

  it('saveGraph 重复 slug 执行 upsert', async () => {
    await store.saveGraph(sampleGraph);
    await store.saveGraph({ ...sampleGraph, name: '更新后的图' });
    const result = await store.getGraph('test-graph');
    expect(result!.name).toBe('更新后的图');
  });

  it('listGraphs 返回所有图', async () => {
    await store.saveGraph(sampleGraph);
    await store.saveGraph({ ...sampleGraph, id: 'g2', slug: 'graph-2', name: '图2' });
    const list = await store.listGraphs();
    expect(list).toHaveLength(2);
  });

  it('listGraphs 空数据返回空数组', async () => {
    const list = await store.listGraphs();
    expect(list).toEqual([]);
  });

  it('icon 为空时返回 undefined', async () => {
    await store.saveGraph({ ...sampleGraph, icon: undefined });
    const result = await store.getGraph('test-graph');
    expect(result!.icon).toBeUndefined();
  });
});
