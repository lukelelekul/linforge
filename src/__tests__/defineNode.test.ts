import { describe, it, expect } from 'vitest';
import { defineNode } from '../core/defineNode';

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
