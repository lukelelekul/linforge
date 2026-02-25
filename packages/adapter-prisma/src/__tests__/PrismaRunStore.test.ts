import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { RunRecord } from 'linforge/core';
import { PrismaRunStore } from '../PrismaRunStore';
import { createTestPrisma, cleanDatabase } from './helpers';

const prisma = createTestPrisma();
let store: PrismaRunStore;

const sampleRun: Omit<RunRecord, 'finishedAt'> = {
  id: 'run-1',
  graphSlug: 'test-graph',
  status: 'running',
  input: { instruction: '你好' },
  metadata: { userId: 'u1', tenantId: 't1' },
  tokensUsed: 0,
  startedAt: new Date('2025-01-01T00:00:00Z'),
};

beforeAll(async () => {
  store = new PrismaRunStore(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await cleanDatabase(prisma);
});

describe('PrismaRunStore', () => {
  it('createRun + getRun 基本 CRUD', async () => {
    await store.createRun(sampleRun);
    const result = await store.getRun('run-1');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('run-1');
    expect(result!.status).toBe('running');
    expect(result!.input).toEqual({ instruction: '你好' });
  });

  it('getRun 不存在返回 null', async () => {
    const result = await store.getRun('nonexistent');
    expect(result).toBeNull();
  });

  it('updateRunStatus 更新状态并自动设 finishedAt', async () => {
    await store.createRun(sampleRun);
    await store.updateRunStatus('run-1', 'completed', { answer: '你好！' });
    const result = await store.getRun('run-1');
    expect(result!.status).toBe('completed');
    expect(result!.result).toEqual({ answer: '你好！' });
    expect(result!.finishedAt).toBeInstanceOf(Date);
  });

  it('updateRunStatus running 状态不设 finishedAt', async () => {
    await store.createRun(sampleRun);
    await store.updateRunStatus('run-1', 'running');
    const result = await store.getRun('run-1');
    expect(result!.finishedAt).toBeUndefined();
  });

  it('listRuns 按 startedAt 倒序', async () => {
    await store.createRun(sampleRun);
    await store.createRun({
      ...sampleRun,
      id: 'run-2',
      startedAt: new Date('2025-01-02T00:00:00Z'),
    });
    const list = await store.listRuns('test-graph');
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe('run-2');
    expect(list[1].id).toBe('run-1');
  });

  it('listRuns 分页 limit/offset', async () => {
    for (let i = 0; i < 5; i++) {
      await store.createRun({
        ...sampleRun,
        id: `run-${i}`,
        startedAt: new Date(`2025-01-0${i + 1}T00:00:00Z`),
      });
    }
    const page = await store.listRuns('test-graph', { limit: 2, offset: 1 });
    expect(page).toHaveLength(2);
    expect(page[0].id).toBe('run-3');
    expect(page[1].id).toBe('run-2');
  });

  it('listRuns 只返回匹配的 graphSlug', async () => {
    await store.createRun(sampleRun);
    await store.createRun({ ...sampleRun, id: 'run-other', graphSlug: 'other-graph' });
    const list = await store.listRuns('test-graph');
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('run-1');
  });
});
