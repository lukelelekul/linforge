import { describe, it, expect, beforeEach } from 'vitest';
import { TemplateRegistry } from '../core/TemplateRegistry';
import { builtinTemplates } from '../core/builtinTemplates';
import type { GraphTemplate } from '../core/types';

const makeTemplate = (
  id: string,
  overrides?: Partial<GraphTemplate>,
): GraphTemplate => ({
  id,
  name: `模板 ${id}`,
  description: `${id} 描述`,
  nodes: [{ key: 'a', label: 'A' }],
  edges: [],
  ...overrides,
});

describe('TemplateRegistry', () => {
  let registry: TemplateRegistry;

  beforeEach(() => {
    registry = new TemplateRegistry();
  });

  it('register + get 注册并获取模板', () => {
    const t = makeTemplate('test-1');
    registry.register(t);

    expect(registry.get('test-1')).toBe(t);
  });

  it('has 检查模板是否已注册', () => {
    registry.register(makeTemplate('test-1'));

    expect(registry.has('test-1')).toBe(true);
    expect(registry.has('unknown')).toBe(false);
  });

  it('重复注册同一 id 抛出异常', () => {
    registry.register(makeTemplate('test-1'));

    expect(() => registry.register(makeTemplate('test-1'))).toThrowError(
      '不允许重复注册',
    );
  });

  it('registerAll 批量注册', () => {
    registry.registerAll([makeTemplate('a'), makeTemplate('b')]);

    expect(registry.list()).toHaveLength(2);
  });

  it('list 返回所有模板', () => {
    registry.registerAll([
      makeTemplate('x'),
      makeTemplate('y'),
      makeTemplate('z'),
    ]);

    const ids = registry.list().map((t) => t.id);
    expect(ids).toEqual(['x', 'y', 'z']);
  });

  it('listByCategory 按分类筛选', () => {
    registry.registerAll([
      makeTemplate('a', { category: 'agent' }),
      makeTemplate('b', { category: 'pipeline' }),
      makeTemplate('c', { category: 'agent' }),
    ]);

    const agents = registry.listByCategory('agent');
    expect(agents).toHaveLength(2);
    expect(agents.map((t) => t.id)).toEqual(['a', 'c']);
  });

  it('listByCategory 不匹配时返回空数组', () => {
    registry.register(makeTemplate('a', { category: 'agent' }));

    expect(registry.listByCategory('pipeline')).toEqual([]);
  });

  it('get 未注册的模板返回 undefined', () => {
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  describe('内置模板', () => {
    it('4 个内置模板可批量注册', () => {
      registry.registerAll(builtinTemplates);

      expect(registry.list()).toHaveLength(4);
    });

    it('内置模板 id 不重复', () => {
      const ids = builtinTemplates.map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('每个内置模板至少有 2 个节点和 1 条边', () => {
      for (const t of builtinTemplates) {
        expect(t.nodes.length).toBeGreaterThanOrEqual(2);
        expect(t.edges.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('内置模板节点 key 在模板内不重复', () => {
      for (const t of builtinTemplates) {
        const keys = t.nodes.map((n) => n.key);
        expect(new Set(keys).size).toBe(keys.length);
      }
    });

    it('内置模板边的 source/target 引用有效节点或 __start__/__end__', () => {
      for (const t of builtinTemplates) {
        const validKeys = new Set([
          ...t.nodes.map((n) => n.key),
          '__start__',
          '__end__',
        ]);
        for (const e of t.edges) {
          expect(validKeys.has(e.source)).toBe(true);
          expect(validKeys.has(e.target)).toBe(true);
        }
      }
    });
  });
});
