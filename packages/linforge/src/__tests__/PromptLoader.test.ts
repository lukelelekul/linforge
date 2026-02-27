import { describe, it, expect, beforeEach } from 'vitest';
import { createPromptLoader, renderPrompt } from '../core/PromptLoader';
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

  describe('render', () => {
    it('store 有激活版本时使用 DB 模板', async () => {
      store.setPrompt('planner', '你好 {{name}}', 0.3);
      const loader = createPromptLoader(store);

      const result = await loader.render('planner', { name: '世界' });

      expect(result.text).toBe('你好 世界');
      expect(result.temperature).toBe(0.3);
      expect(result.source).toBe('store');
    });

    it('store 无激活版本时使用 fallback', async () => {
      const loader = createPromptLoader(store);

      const result = await loader.render(
        'unknown',
        { name: '世界' },
        { template: 'fallback: {{name}}', temperature: 0.5 },
      );

      expect(result.text).toBe('fallback: 世界');
      expect(result.temperature).toBe(0.5);
      expect(result.source).toBe('fallback');
    });

    it('fallback 未传 temperature 时默认 0.7', async () => {
      const loader = createPromptLoader(store);

      const result = await loader.render(
        'unknown',
        {},
        { template: 'hello' },
      );

      expect(result.temperature).toBe(0.7);
      expect(result.source).toBe('fallback');
    });

    it('无激活版本且无 fallback 时抛错', async () => {
      const loader = createPromptLoader(store);

      await expect(loader.render('unknown', {})).rejects.toThrow(
        'No active prompt for node "unknown" and no fallback provided',
      );
    });

    it('变量替换 {{var}} 正常工作', async () => {
      store.setPrompt('node', '{{greeting}}, {{target}}!', 0.5);
      const loader = createPromptLoader(store);

      const result = await loader.render('node', {
        greeting: 'Hello',
        target: 'World',
      });

      expect(result.text).toBe('Hello, World!');
    });

    it('三括号 {{{raw}}} 不做 HTML 转义', async () => {
      store.setPrompt('node', '{{{content}}}', 0.5);
      const loader = createPromptLoader(store);

      const result = await loader.render('node', {
        content: '<b>bold</b>',
      });

      expect(result.text).toBe('<b>bold</b>');
    });

    it('双括号 {{var}} 也不做 HTML 转义（已禁用转义）', async () => {
      store.setPrompt('node', '{{content}}', 0.5);
      const loader = createPromptLoader(store);

      const result = await loader.render('node', {
        content: '<b>bold</b> & "quotes"',
      });

      expect(result.text).toBe('<b>bold</b> & "quotes"');
    });

    it('条件块 {{#flag}}...{{/flag}} 正常工作', async () => {
      store.setPrompt('node', '{{#verbose}}详细模式{{/verbose}}{{^verbose}}简洁模式{{/verbose}}', 0.5);
      const loader = createPromptLoader(store);

      const withFlag = await loader.render('node', { verbose: true });
      expect(withFlag.text).toBe('详细模式');

      const withoutFlag = await loader.render('node', { verbose: false });
      expect(withoutFlag.text).toBe('简洁模式');
    });

    it('render 复用 getActivePrompt 缓存', async () => {
      store.setPrompt('planner', '{{name}} v1', 0.3);
      const loader = createPromptLoader(store);

      // 首次 render 触发缓存
      const first = await loader.render('planner', { name: 'test' });
      expect(first.text).toBe('test v1');

      // 修改 store 数据
      store.setPrompt('planner', '{{name}} v2', 0.5);

      // 第二次 render 仍使用缓存
      const second = await loader.render('planner', { name: 'test' });
      expect(second.text).toBe('test v1');
      expect(second.temperature).toBe(0.3);
    });
  });
});

describe('renderPrompt', () => {
  it('渲染简单变量', () => {
    expect(renderPrompt('Hello {{name}}', { name: 'World' })).toBe(
      'Hello World',
    );
  });

  it('禁用 HTML 转义', () => {
    expect(renderPrompt('{{html}}', { html: '<div>"&</div>' })).toBe(
      '<div>"&</div>',
    );
  });

  it('支持条件块', () => {
    const tpl = '{{#show}}visible{{/show}}{{^show}}hidden{{/show}}';
    expect(renderPrompt(tpl, { show: true })).toBe('visible');
    expect(renderPrompt(tpl, { show: false })).toBe('hidden');
  });

  it('支持列表迭代', () => {
    const tpl = '{{#items}}{{.}} {{/items}}';
    expect(renderPrompt(tpl, { items: ['a', 'b', 'c'] })).toBe('a b c ');
  });
});
