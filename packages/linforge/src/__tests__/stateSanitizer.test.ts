import { describe, it, expect } from 'vitest';
import { sanitizeState } from '../core/stateSanitizer';

describe('sanitizeState', () => {
  it('保留普通标量字段', () => {
    const state = { iteration: 3, tokensUsed: 1500, plan: 'fetch data' };
    const result = sanitizeState(state);
    expect(result).toEqual(state);
  });

  it('保留数组和嵌套对象', () => {
    const state = {
      items: [{ title: 'a' }, { title: 'b' }],
      config: { maxIterations: 15 },
    };
    const result = sanitizeState(state);
    expect(result).toEqual(state);
  });

  it('跳过函数值', () => {
    const state = {
      iteration: 1,
      callback: () => {},
      nested: { fn: () => {}, val: 42 },
    };
    const result = sanitizeState(state);
    expect(result.iteration).toBe(1);
    expect(result.callback).toBeUndefined();
    expect((result.nested as Record<string, unknown>).fn).toBeUndefined();
    expect((result.nested as Record<string, unknown>).val).toBe(42);
  });

  it('截断超长字符串', () => {
    const longStr = 'a'.repeat(6000);
    const state = { content: longStr };
    const result = sanitizeState(state);
    const content = result.content as string;
    expect(content.length).toBeLessThan(longStr.length);
    expect(content).toContain('...[truncated');
    expect(content).toContain('6000 chars');
  });

  it('处理 BaseMessage 类对象', () => {
    // 模拟 LangChain BaseMessage
    const fakeMessage = {
      _getType: () => 'ai',
      content: 'hello world',
      tool_calls: [{ name: 'fetchDevto', args: { tag: 'react' } }],
      lc_kwargs: { some: 'internal' },
    };
    const state = { messages: [fakeMessage] };
    const result = sanitizeState(state);
    const msgs = result.messages as Record<string, unknown>[];
    expect(msgs).toHaveLength(1);
    expect(msgs[0]._type).toBe('ai');
    expect(msgs[0].content).toBe('hello world');
    expect(msgs[0].tool_calls).toEqual([
      { name: 'fetchDevto', args: { tag: 'react' } },
    ]);
    // 不应包含内部字段
    expect(msgs[0].lc_kwargs).toBeUndefined();
  });

  it('BaseMessage 无 tool_calls 时省略', () => {
    const fakeMessage = {
      _getType: () => 'human',
      content: 'test',
      tool_calls: [],
    };
    const state = { messages: [fakeMessage] };
    const result = sanitizeState(state);
    const msgs = result.messages as Record<string, unknown>[];
    expect(msgs[0].tool_calls).toBeUndefined();
  });

  it('处理 null 和 undefined 值', () => {
    const state = { a: null, b: undefined, c: 0, d: '' };
    const result = sanitizeState(state);
    expect(result.a).toBeNull();
    // JSON.stringify 会移除 undefined
    expect('b' in result).toBe(false);
    expect(result.c).toBe(0);
    expect(result.d).toBe('');
  });

  it('循环引用回退到浅层摘要', () => {
    const state: Record<string, unknown> = { iteration: 1 };
    // 制造循环引用
    state.self = state;
    const result = sanitizeState(state);
    // 应返回浅层摘要而非抛出
    expect(result.iteration).toBe(1);
    expect(typeof result.self).toBe('string');
  });
});
