import { describe, it, expect, beforeEach } from 'vitest';
import { createPromptLoader } from '../core/PromptLoader';
import { MemoryPromptStore } from '../testing/MemoryPromptStore';

describe('PromptLoader', () => {
  let store: MemoryPromptStore;

  beforeEach(() => {
    store = new MemoryPromptStore();
  });

  it('缓存未命中时查询 store', async () => {
    store.setPrompt('planner', '你是一个规划者...', 0.3);

    const loader = createPromptLoader(store);
    const result = await loader.getActivePrompt('planner');

    expect(result).toMatchObject({
      template: '你是一个规划者...',
      temperature: 0.3,
      nodeId: 'planner',
      isActive: true,
    });
  });

  it('缓存命中时不再查询 store', async () => {
    store.setPrompt('planner', 'version1', 0.3);

    const loader = createPromptLoader(store);

    // 首次查询
    const first = await loader.getActivePrompt('planner');

    // 修改 store 数据
    store.setPrompt('planner', 'version2', 0.5);

    // 第二次查询应返回缓存结果
    const cached = await loader.getActivePrompt('planner');
    expect(cached!.id).toBe(first!.id);
    expect(cached!.template).toBe('version1');
  });

  it('store 返回 null 时不缓存', async () => {
    const loader = createPromptLoader(store);

    // 查询不存在的
    const first = await loader.getActivePrompt('unknown');
    expect(first).toBeNull();

    // 现在添加
    store.setPrompt('unknown', 'found', 0.2);

    // 应该能获取到新添加的
    const second = await loader.getActivePrompt('unknown');
    expect(second).not.toBeNull();
    expect(second!.template).toBe('found');
  });

  it('invalidateCache 清除单条缓存', async () => {
    store.setPrompt('planner', 'v1', 0.3);
    store.setPrompt('analyzer', 'v1', 0.3);

    const loader = createPromptLoader(store);

    await loader.getActivePrompt('planner');
    await loader.getActivePrompt('analyzer');

    // 更新 planner
    store.setPrompt('planner', 'v2', 0.5);

    // 清除 planner 缓存
    loader.invalidateCache('planner');

    // planner 应返回新版本
    const planner = await loader.getActivePrompt('planner');
    expect(planner!.template).toBe('v2');

    // analyzer 仍使用缓存
    const analyzer = await loader.getActivePrompt('analyzer');
    expect(analyzer!.template).toBe('v1');
  });

  it('invalidateCache 不传参数时清除全部', async () => {
    store.setPrompt('planner', 'v1', 0.3);
    store.setPrompt('analyzer', 'v1', 0.3);

    const loader = createPromptLoader(store);

    await loader.getActivePrompt('planner');
    await loader.getActivePrompt('analyzer');

    // 更新两个
    store.setPrompt('planner', 'v2', 0.5);
    store.setPrompt('analyzer', 'v2', 0.5);

    // 清除全部缓存
    loader.invalidateCache();

    const planner = await loader.getActivePrompt('planner');
    const analyzer = await loader.getActivePrompt('analyzer');
    expect(planner!.template).toBe('v2');
    expect(analyzer!.template).toBe('v2');
  });
});
