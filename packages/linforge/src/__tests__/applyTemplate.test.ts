import { describe, it, expect } from 'vitest';
import { applyTemplate } from '../core/applyTemplate';
import type { GraphTemplate, GraphDefinition } from '../core/types';

/** 空图定义 */
const emptyGraph: GraphDefinition = {
  id: 'g1',
  slug: 'test',
  name: '测试图',
  nodes: [
    { key: '__start__', label: '开始', nodeType: 'start' },
    { key: '__end__', label: '结束', nodeType: 'end' },
  ],
  edges: [],
};

/** 简单线性模板 */
const linearTemplate: GraphTemplate = {
  id: 'linear',
  name: '线性模板',
  description: '测试用',
  nodes: [
    { key: 'a', label: 'A' },
    { key: 'b', label: 'B' },
    { key: 'c', label: 'C' },
  ],
  edges: [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
  ],
};

/** 带条件边的模板 */
const conditionalTemplate: GraphTemplate = {
  id: 'conditional',
  name: '条件模板',
  description: '测试条件边',
  nodes: [
    { key: 'router', label: 'Router' },
    { key: 'pathA', label: 'Path A' },
    { key: 'pathB', label: 'Path B' },
  ],
  edges: [
    {
      source: 'router',
      target: 'pathA',
      label: '路由',
      routeMap: { go_a: 'pathA', go_b: 'pathB' },
    },
  ],
};

describe('applyTemplate', () => {
  describe('空画布应用', () => {
    it('模板节点全部添加到图中', () => {
      const { graph } = applyTemplate(linearTemplate, emptyGraph);

      // 原有 __start__ + __end__ + 模板 3 个节点
      expect(graph.nodes).toHaveLength(5);
      expect(graph.nodes.map((n) => n.key)).toContain('a');
      expect(graph.nodes.map((n) => n.key)).toContain('b');
      expect(graph.nodes.map((n) => n.key)).toContain('c');
    });

    it('模板边全部添加', () => {
      const { graph } = applyTemplate(linearTemplate, emptyGraph);

      expect(graph.edges).toHaveLength(2);
      expect(graph.edges[0].source).toBe('a');
      expect(graph.edges[0].target).toBe('b');
    });

    it('节点 label 和 description 保留', () => {
      const { graph } = applyTemplate(linearTemplate, emptyGraph);

      const nodeA = graph.nodes.find((n) => n.key === 'a');
      expect(nodeA?.label).toBe('A');
    });

    it('所有节点都有 position', () => {
      const { graph } = applyTemplate(linearTemplate, emptyGraph);

      for (const node of graph.nodes.filter((n) => !n.key.startsWith('__'))) {
        expect(node.position).toBeDefined();
        expect(typeof node.position!.x).toBe('number');
        expect(typeof node.position!.y).toBe('number');
      }
    });

    it('无 key 冲突时 renamedKeys 为空', () => {
      const { renamedKeys } = applyTemplate(linearTemplate, emptyGraph);

      expect(Object.keys(renamedKeys)).toHaveLength(0);
    });

    it('保留原图的 id/slug/name', () => {
      const { graph } = applyTemplate(linearTemplate, emptyGraph);

      expect(graph.id).toBe('g1');
      expect(graph.slug).toBe('test');
      expect(graph.name).toBe('测试图');
    });
  });

  describe('追加合并', () => {
    const existingGraph: GraphDefinition = {
      id: 'g2',
      slug: 'existing',
      name: '已有图',
      nodes: [
        { key: '__start__', label: '开始', nodeType: 'start' },
        {
          key: 'planner',
          label: '规划',
          position: { x: 100, y: 100 },
        },
        {
          key: 'tools',
          label: '工具',
          position: { x: 380, y: 100 },
        },
        { key: '__end__', label: '结束', nodeType: 'end' },
      ],
      edges: [{ source: 'planner', target: 'tools' }],
    };

    it('模板节点追加到已有节点之后', () => {
      const { graph } = applyTemplate(linearTemplate, existingGraph);

      // 原有 4 个 + 模板 3 个
      expect(graph.nodes).toHaveLength(7);
    });

    it('已有边保留', () => {
      const { graph } = applyTemplate(linearTemplate, existingGraph);

      expect(graph.edges[0].source).toBe('planner');
      expect(graph.edges[0].target).toBe('tools');
    });

    it('模板节点放在已有节点右侧', () => {
      const { graph } = applyTemplate(linearTemplate, existingGraph);

      const templateNodes = graph.nodes.filter(
        (n) =>
          !n.key.startsWith('__') && n.key !== 'planner' && n.key !== 'tools',
      );

      // 已有节点最右 x=380，模板节点应在更右边
      for (const node of templateNodes) {
        expect(node.position!.x).toBeGreaterThan(380);
      }
    });
  });

  describe('key 冲突处理', () => {
    const graphWithConflict: GraphDefinition = {
      id: 'g3',
      slug: 'conflict',
      name: '冲突图',
      nodes: [
        { key: '__start__', label: '开始', nodeType: 'start' },
        { key: 'a', label: '已有 A', position: { x: 100, y: 100 } },
        { key: '__end__', label: '结束', nodeType: 'end' },
      ],
      edges: [],
    };

    it('冲突 key 自动加后缀', () => {
      const { graph, renamedKeys } = applyTemplate(
        linearTemplate,
        graphWithConflict,
      );

      // 'a' 已存在，应被重命名为 'a_2'
      expect(renamedKeys['a']).toBe('a_2');
      expect(graph.nodes.map((n) => n.key)).toContain('a_2');
    });

    it('重命名后边的 source/target 也更新', () => {
      const { graph, renamedKeys } = applyTemplate(
        linearTemplate,
        graphWithConflict,
      );

      const renamedKey = renamedKeys['a'];
      // a->b 的边应变为 a_2->b
      const edge = graph.edges.find((e) => e.source === renamedKey);
      expect(edge).toBeDefined();
      expect(edge!.target).toBe('b');
    });

    it('多次冲突递增后缀', () => {
      const graphWithMultipleConflicts: GraphDefinition = {
        id: 'g4',
        slug: 'multi-conflict',
        name: '多冲突',
        nodes: [
          { key: '__start__', label: '开始', nodeType: 'start' },
          { key: 'a', label: '已有 A', position: { x: 100, y: 100 } },
          { key: 'a_2', label: '已有 A2', position: { x: 200, y: 100 } },
          { key: '__end__', label: '结束', nodeType: 'end' },
        ],
        edges: [],
      };

      const { renamedKeys } = applyTemplate(
        linearTemplate,
        graphWithMultipleConflicts,
      );

      // 'a' 和 'a_2' 都已存在，应命名为 'a_3'
      expect(renamedKeys['a']).toBe('a_3');
    });
  });

  describe('条件边处理', () => {
    it('条件边的 routeMap 正确映射', () => {
      const { graph } = applyTemplate(conditionalTemplate, emptyGraph);

      const conditionalEdge = graph.edges.find((e) => e.routeMap);
      expect(conditionalEdge).toBeDefined();
      expect(conditionalEdge!.routeMap).toEqual({
        go_a: 'pathA',
        go_b: 'pathB',
      });
    });

    it('key 冲突时 routeMap 中的 target 也更新', () => {
      const graphWithPathA: GraphDefinition = {
        id: 'g5',
        slug: 'route-conflict',
        name: '路由冲突',
        nodes: [
          { key: '__start__', label: '开始', nodeType: 'start' },
          {
            key: 'pathA',
            label: '已有 PathA',
            position: { x: 100, y: 100 },
          },
          { key: '__end__', label: '结束', nodeType: 'end' },
        ],
        edges: [],
      };

      const { graph, renamedKeys } = applyTemplate(
        conditionalTemplate,
        graphWithPathA,
      );

      expect(renamedKeys['pathA']).toBe('pathA_2');

      const conditionalEdge = graph.edges.find((e) => e.routeMap);
      expect(conditionalEdge!.routeMap!['go_a']).toBe('pathA_2');
      expect(conditionalEdge!.routeMap!['go_b']).toBe('pathB');
    });
  });

  describe('START/END 边过滤', () => {
    const templateWithTerminals: GraphTemplate = {
      id: 'with-terminals',
      name: '带终端边模板',
      description: '测试',
      nodes: [
        { key: 'x', label: 'X' },
        { key: 'y', label: 'Y' },
      ],
      edges: [
        { source: '__start__', target: 'x' },
        { source: 'x', target: 'y' },
        { source: 'y', target: '__end__' },
      ],
    };

    it('空画布也过滤 __start__/__end__ 边（由画布管理）', () => {
      const { graph } = applyTemplate(templateWithTerminals, emptyGraph);

      // 只保留 x->y，过滤 __start__->x 和 y->__end__
      expect(graph.edges).toHaveLength(1);
      expect(graph.edges[0].source).toBe('x');
      expect(graph.edges[0].target).toBe('y');
    });

    it('追加模式过滤 __start__/__end__ 边', () => {
      const existingGraph: GraphDefinition = {
        id: 'g6',
        slug: 'append',
        name: '追加',
        nodes: [
          { key: '__start__', label: '开始', nodeType: 'start' },
          { key: 'existing', label: '已有', position: { x: 100, y: 100 } },
          { key: '__end__', label: '结束', nodeType: 'end' },
        ],
        edges: [],
      };

      const { graph } = applyTemplate(templateWithTerminals, existingGraph);

      // 模板的 __start__/__end__ 边被过滤
      const newEdges = graph.edges;
      expect(newEdges).toHaveLength(1);
      expect(newEdges[0].source).toBe('x');
    });
  });

  describe('自动布局', () => {
    it('线性模板节点按拓扑排序从左到右排列', () => {
      const { graph } = applyTemplate(linearTemplate, emptyGraph);

      const nodeA = graph.nodes.find((n) => n.key === 'a')!;
      const nodeB = graph.nodes.find((n) => n.key === 'b')!;
      const nodeC = graph.nodes.find((n) => n.key === 'c')!;

      // a 在 b 左边，b 在 c 左边
      expect(nodeA.position!.x).toBeLessThan(nodeB.position!.x);
      expect(nodeB.position!.x).toBeLessThan(nodeC.position!.x);
    });

    it('分支模板同层节点 x 相同', () => {
      const branchTemplate: GraphTemplate = {
        id: 'branch',
        name: '分支',
        description: '测试',
        nodes: [
          { key: 'root', label: 'Root' },
          { key: 'left', label: 'Left' },
          { key: 'right', label: 'Right' },
        ],
        edges: [
          { source: 'root', target: 'left' },
          { source: 'root', target: 'right' },
        ],
      };

      const { graph } = applyTemplate(branchTemplate, emptyGraph);

      const left = graph.nodes.find((n) => n.key === 'left')!;
      const right = graph.nodes.find((n) => n.key === 'right')!;

      // left 和 right 在同一层（同一 x）
      expect(left.position!.x).toBe(right.position!.x);
      // 但 y 不同
      expect(left.position!.y).not.toBe(right.position!.y);
    });
  });
});
