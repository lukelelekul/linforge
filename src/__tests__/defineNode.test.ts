import { describe, it, expect } from 'vitest';
import { defineNode, defineNodeFor } from '../core/defineNode';
import { StateSchema } from '@langchain/langgraph';
import { z } from 'zod/v4';

describe('defineNode', () => {
  it('创建包含 key 和 run 的节点定义', () => {
    const node = defineNode({
      key: 'planner',
      run: async (state: { count: number }) => ({ count: state.count + 1 }),
    });

    expect(node.key).toBe('planner');
    expect(typeof node.run).toBe('function');
  });

  it('key 为空时抛出异常', () => {
    expect(() => defineNode({ key: '', run: async () => ({}) })).toThrowError(
      'key 是必填字段',
    );
  });

  it('key 非字符串时抛出异常', () => {
    expect(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      defineNode({ key: 123 as any, run: async () => ({}) }),
    ).toThrowError('key 是必填字段');
  });

  it('run 非函数时抛出异常', () => {
    expect(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      defineNode({ key: 'test', run: 'not-a-fn' as any }),
    ).toThrowError('run 是必填字段');
  });

  it('返回冻结的对象（不可修改）', () => {
    const node = defineNode({
      key: 'frozen',
      run: async () => ({}),
    });

    expect(Object.isFrozen(node)).toBe(true);
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (node as any).key = 'changed';
    }).toThrow();
  });

  it('支持可选的 routes 字段', () => {
    const node = defineNode({
      key: 'router',
      routes: {
        has_tools: (s: { tools: boolean }) => s.tools,
        no_tools: (s: { tools: boolean }) => !s.tools,
      },
      run: async () => ({}),
    });

    expect(node.routes).toBeDefined();
    expect(node.routes!.has_tools({ tools: true })).toBe(true);
    expect(node.routes!.no_tools({ tools: true })).toBe(false);
  });

  it('支持可选的 summarizeOutput 字段', () => {
    const summarizer = (_input: unknown, output: unknown) => ({
      summary: output,
    });

    const node = defineNode({
      key: 'with-summarizer',
      run: async () => ({}),
      summarizeOutput: summarizer,
    });

    expect(node.summarizeOutput).toBe(summarizer);
  });

  it('未传 routes 时结果不包含该字段', () => {
    const node = defineNode({
      key: 'no-routes',
      run: async () => ({}),
    });

    expect('routes' in node).toBe(false);
  });
});

describe('defineNodeFor', () => {
  const TestState = new StateSchema({
    count: z.number().default(0),
    label: z.string().default(''),
  });

  it('返回的函数能正常创建 node', () => {
    const defineMyNode = defineNodeFor(TestState);
    const node = defineMyNode({
      key: 'counter',
      run: async (state) => ({ count: state.count + 1 }),
    });

    expect(node.key).toBe('counter');
    expect(typeof node.run).toBe('function');
    expect(Object.isFrozen(node)).toBe(true);
  });

  it('创建的 node 与直接 defineNode 行为一致', async () => {
    const defineMyNode = defineNodeFor(TestState);
    const nodeA = defineMyNode({
      key: 'adder',
      run: async (state) => ({ count: state.count + 10 }),
    });

    const nodeB = defineNode<typeof TestState.State>({
      key: 'adder',
      run: async (state) => ({ count: state.count + 10 }),
    });

    const input = { count: 5, label: 'test' };
    const resultA = await nodeA.run(input);
    const resultB = await nodeB.run(input);

    expect(resultA).toEqual(resultB);
    expect(resultA).toEqual({ count: 15 });
  });

  it('支持 routes 和 summarizeOutput', () => {
    const defineMyNode = defineNodeFor(TestState);
    const node = defineMyNode({
      key: 'router',
      routes: {
        positive: (s) => s.count > 0,
      },
      run: async (state) => ({ count: state.count }),
      summarizeOutput: (_input, output) => ({ summary: output }),
    });

    expect(node.routes).toBeDefined();
    expect(node.routes!.positive({ count: 1, label: '' })).toBe(true);
    expect(node.routes!.positive({ count: -1, label: '' })).toBe(false);
    expect(node.summarizeOutput).toBeDefined();
  });
});
