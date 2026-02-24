import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryPromptStore } from '../testing/MemoryPromptStore';

describe('MemoryPromptStore', () => {
  let store: MemoryPromptStore;

  beforeEach(() => {
    store = new MemoryPromptStore();
  });

  // === getActivePrompt ===

  it('getActivePrompt 无数据时返回 null', async () => {
    const result = await store.getActivePrompt('planner');
    expect(result).toBeNull();
  });

  it('getActivePrompt 返回激活版本', async () => {
    store.setPrompt('planner', 'template content', 0.5);
    const result = await store.getActivePrompt('planner');

    expect(result).not.toBeNull();
    expect(result!.template).toBe('template content');
    expect(result!.temperature).toBe(0.5);
    expect(result!.nodeId).toBe('planner');
    expect(result!.isActive).toBe(true);
  });

  // === listVersions ===

  it('listVersions 按 version desc 排序', async () => {
    await store.createVersion('planner', { template: 'v1' });
    await store.createVersion('planner', { template: 'v2' });
    await store.createVersion('planner', { template: 'v3' });

    const list = await store.listVersions('planner');

    expect(list).toHaveLength(3);
    expect(list[0].version).toBe(3);
    expect(list[1].version).toBe(2);
    expect(list[2].version).toBe(1);
    expect(list[0].template).toBe('v3');
  });

  it('listVersions 不同 nodeId 互不影响', async () => {
    await store.createVersion('planner', { template: 'planner v1' });
    await store.createVersion('analyzer', { template: 'analyzer v1' });

    const plannerList = await store.listVersions('planner');
    const analyzerList = await store.listVersions('analyzer');

    expect(plannerList).toHaveLength(1);
    expect(analyzerList).toHaveLength(1);
    expect(plannerList[0].template).toBe('planner v1');
    expect(analyzerList[0].template).toBe('analyzer v1');
  });

  it('listVersions 无数据时返回空数组', async () => {
    const list = await store.listVersions('unknown');
    expect(list).toEqual([]);
  });

  // === createVersion ===

  it('createVersion 版本号自增', async () => {
    const v1 = await store.createVersion('planner', { template: 't1' });
    const v2 = await store.createVersion('planner', { template: 't2' });

    expect(v1.version).toBe(1);
    expect(v2.version).toBe(2);
  });

  it('createVersion 默认 temperature 0.3', async () => {
    const v = await store.createVersion('planner', { template: 'test' });
    expect(v.temperature).toBe(0.3);
  });

  it('createVersion 自定义 temperature', async () => {
    const v = await store.createVersion('planner', {
      template: 'test',
      temperature: 0.7,
    });
    expect(v.temperature).toBe(0.7);
  });

  it('createVersion 默认不激活', async () => {
    const v = await store.createVersion('planner', { template: 'test' });
    expect(v.isActive).toBe(false);
  });

  it('createVersion 返回完整 PromptVersion', async () => {
    const v = await store.createVersion('analyzer', {
      template: 'my template',
      temperature: 0.5,
    });

    expect(v.id).toBeTruthy();
    expect(v.nodeId).toBe('analyzer');
    expect(v.version).toBe(1);
    expect(v.template).toBe('my template');
    expect(v.temperature).toBe(0.5);
    expect(v.isActive).toBe(false);
    expect(v.createdAt).toBeInstanceOf(Date);
  });

  // === activateVersion ===

  it('activateVersion 激活指定版本', async () => {
    const v1 = await store.createVersion('planner', { template: 't1' });
    await store.activateVersion('planner', v1.id);

    const active = await store.getActivePrompt('planner');
    expect(active!.id).toBe(v1.id);
    expect(active!.isActive).toBe(true);
  });

  it('activateVersion 同 nodeId 互斥', async () => {
    const v1 = await store.createVersion('planner', { template: 't1' });
    const v2 = await store.createVersion('planner', { template: 't2' });

    await store.activateVersion('planner', v1.id);
    expect((await store.getActivePrompt('planner'))!.id).toBe(v1.id);

    // 激活 v2 后，v1 自动取消
    await store.activateVersion('planner', v2.id);
    const active = await store.getActivePrompt('planner');
    expect(active!.id).toBe(v2.id);
    expect(active!.template).toBe('t2');

    // 确认 v1 不再激活
    const list = await store.listVersions('planner');
    const v1Updated = list.find((v) => v.id === v1.id);
    expect(v1Updated!.isActive).toBe(false);
  });

  it('activateVersion 不影响其他 nodeId', async () => {
    const pv = await store.createVersion('planner', { template: 'p' });
    const av = await store.createVersion('analyzer', { template: 'a' });

    await store.activateVersion('planner', pv.id);
    await store.activateVersion('analyzer', av.id);

    // 两个 nodeId 各自有独立的激活版本
    expect((await store.getActivePrompt('planner'))!.id).toBe(pv.id);
    expect((await store.getActivePrompt('analyzer'))!.id).toBe(av.id);
  });

  it('activateVersion 不存在的 nodeId 抛错', async () => {
    await expect(store.activateVersion('unknown', 'fake-id')).rejects.toThrow(
      'No versions found',
    );
  });

  it('activateVersion 不存在的 versionId 抛错', async () => {
    await store.createVersion('planner', { template: 'test' });
    await expect(
      store.activateVersion('planner', 'nonexistent'),
    ).rejects.toThrow('Version not found');
  });

  // === setPrompt 便捷方法 ===

  it('setPrompt 创建并激活版本', async () => {
    store.setPrompt('planner', 'quick setup', 0.4);

    const active = await store.getActivePrompt('planner');
    expect(active!.template).toBe('quick setup');
    expect(active!.temperature).toBe(0.4);
    expect(active!.isActive).toBe(true);
  });

  it('setPrompt 多次调用只有最后一次激活', async () => {
    store.setPrompt('planner', 'first');
    store.setPrompt('planner', 'second');

    const active = await store.getActivePrompt('planner');
    expect(active!.template).toBe('second');

    const list = await store.listVersions('planner');
    expect(list).toHaveLength(2);
    expect(list.filter((v) => v.isActive)).toHaveLength(1);
  });

  // === clear ===

  it('clear 清空所有数据', async () => {
    store.setPrompt('planner', 'test');
    store.setPrompt('analyzer', 'test');

    store.clear();

    expect(await store.getActivePrompt('planner')).toBeNull();
    expect(await store.getActivePrompt('analyzer')).toBeNull();
    expect(await store.listVersions('planner')).toEqual([]);
  });
});
