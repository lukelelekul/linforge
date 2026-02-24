import { describe, it, expect, beforeEach } from 'vitest';
import { NodeRegistry } from '../core/NodeRegistry';
import { defineNode } from '../core/defineNode';
import type { GraphDefinition } from '../core/types';

const makeNode = (key: string) => defineNode({ key, run: async () => ({}) });

describe('NodeRegistry', () => {
  let registry: NodeRegistry;

  beforeEach(() => {
    registry = new NodeRegistry();
  });

  it('register + get 注册并获取节点', () => {
    const node = makeNode('planner');
    registry.register(node);

    expect(registry.get('planner')).toBe(node);
  });

  it('has 检查节点是否已注册', () => {
    registry.register(makeNode('planner'));

    expect(registry.has('planner')).toBe(true);
    expect(registry.has('unknown')).toBe(false);
  });

  it('重复注册同一 key 抛出异常', () => {
    registry.register(makeNode('planner'));

    expect(() => registry.register(makeNode('planner'))).toThrowError(
      '不允许重复注册',
    );
  });

  it('registerAll 批量注册', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    registry.registerAll(nodes);

    expect(registry.keys()).toEqual(['a', 'b', 'c']);
  });

  it('keys 返回所有已注册的 key', () => {
    registry.register(makeNode('alpha'));
    registry.register(makeNode('beta'));

    expect(registry.keys()).toEqual(['alpha', 'beta']);
  });

  it('entries 返回所有节点定义', () => {
    const a = makeNode('a');
    const b = makeNode('b');
    registry.registerAll([a, b]);

    expect(registry.entries()).toEqual([a, b]);
  });

  describe('getBindingStatus', () => {
    const graphDef: GraphDefinition = {
      id: 'g1',
      slug: 'test-graph',
      name: '测试图',
      nodes: [
        { key: '__start__', label: '开始' },
        { key: 'planner', label: '规划' },
        { key: 'analyzer', label: '分析' },
        { key: 'saver', label: '保存' },
        { key: '__end__', label: '结束' },
      ],
      edges: [],
    };

    it('全部绑定时 skeleton 为空', () => {
      registry.registerAll([
        makeNode('planner'),
        makeNode('analyzer'),
        makeNode('saver'),
      ]);

      const status = registry.getBindingStatus(graphDef);
      expect(status.bound).toEqual(['planner', 'analyzer', 'saver']);
      expect(status.skeleton).toEqual([]);
    });

    it('部分绑定时正确区分', () => {
      registry.register(makeNode('planner'));

      const status = registry.getBindingStatus(graphDef);
      expect(status.bound).toEqual(['planner']);
      expect(status.skeleton).toEqual(['analyzer', 'saver']);
    });

    it('过滤 __start__ 和 __end__ 内部节点', () => {
      registry.registerAll([
        makeNode('planner'),
        makeNode('analyzer'),
        makeNode('saver'),
      ]);

      const status = registry.getBindingStatus(graphDef);
      // __start__ 和 __end__ 不应出现在任何列表中
      expect(status.bound).not.toContain('__start__');
      expect(status.bound).not.toContain('__end__');
      expect(status.skeleton).not.toContain('__start__');
      expect(status.skeleton).not.toContain('__end__');
    });
  });
});
