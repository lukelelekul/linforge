import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaPromptStore } from '../PrismaPromptStore';
import { createTestPrisma, cleanDatabase } from './helpers';

const prisma = createTestPrisma();
let store: PrismaPromptStore;

beforeAll(async () => {
  store = new PrismaPromptStore(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await cleanDatabase(prisma);
});

describe('PrismaPromptStore', () => {
  it('createVersion 自动递增 version', async () => {
    const v1 = await store.createVersion('planner', { template: 'v1 模板' });
    const v2 = await store.createVersion('planner', { template: 'v2 模板' });
    expect(v1.version).toBe(1);
    expect(v2.version).toBe(2);
    expect(v1.isActive).toBe(false);
    expect(v2.isActive).toBe(false);
  });

  it('createVersion 默认 temperature 0.3', async () => {
    const v = await store.createVersion('planner', { template: '模板' });
    expect(v.temperature).toBe(0.3);
  });

  it('createVersion 自定义 temperature', async () => {
    const v = await store.createVersion('planner', {
      template: '模板',
      temperature: 0.7,
    });
    expect(v.temperature).toBe(0.7);
  });

  it('activateVersion 互斥激活', async () => {
    const v1 = await store.createVersion('planner', { template: 'v1' });
    const v2 = await store.createVersion('planner', { template: 'v2' });

    await store.activateVersion('planner', v1.id);
    let active = await store.getActivePrompt('planner');
    expect(active!.id).toBe(v1.id);

    await store.activateVersion('planner', v2.id);
    active = await store.getActivePrompt('planner');
    expect(active!.id).toBe(v2.id);

    // 确认 v1 已被停用
    const versions = await store.listVersions('planner');
    const v1Record = versions.find((v) => v.id === v1.id);
    expect(v1Record!.isActive).toBe(false);
  });

  it('getActivePrompt 无激活版本返回 null', async () => {
    await store.createVersion('planner', { template: '未激活' });
    const active = await store.getActivePrompt('planner');
    expect(active).toBeNull();
  });

  it('getActivePrompt 不存在的 nodeId 返回 null', async () => {
    const active = await store.getActivePrompt('nonexistent');
    expect(active).toBeNull();
  });

  it('listVersions 按 version 降序', async () => {
    await store.createVersion('planner', { template: 'v1' });
    await store.createVersion('planner', { template: 'v2' });
    await store.createVersion('planner', { template: 'v3' });
    const versions = await store.listVersions('planner');
    expect(versions.map((v) => v.version)).toEqual([3, 2, 1]);
  });

  it('不同 nodeId 的 version 独立递增', async () => {
    const p1 = await store.createVersion('planner', { template: 'p-v1' });
    const t1 = await store.createVersion('tools', { template: 't-v1' });
    const p2 = await store.createVersion('planner', { template: 'p-v2' });
    expect(p1.version).toBe(1);
    expect(t1.version).toBe(1);
    expect(p2.version).toBe(2);
  });

  it('不同 nodeId 的激活互不影响', async () => {
    const p1 = await store.createVersion('planner', { template: 'p' });
    const t1 = await store.createVersion('tools', { template: 't' });
    await store.activateVersion('planner', p1.id);
    await store.activateVersion('tools', t1.id);

    const pActive = await store.getActivePrompt('planner');
    const tActive = await store.getActivePrompt('tools');
    expect(pActive!.id).toBe(p1.id);
    expect(tActive!.id).toBe(t1.id);
  });
});
