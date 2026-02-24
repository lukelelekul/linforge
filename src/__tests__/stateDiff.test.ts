import { describe, it, expect } from 'vitest';
import { computeStateDiff } from '../react/stateDiff';

describe('computeStateDiff', () => {
  it('检测新增字段', () => {
    const before = { a: 1 };
    const after = { a: 1, b: 2 };
    const diff = computeStateDiff(before, after);
    const added = diff.find((d) => d.key === 'b');
    expect(added).toBeDefined();
    expect(added!.type).toBe('added');
    expect(added!.after).toBe(2);
  });

  it('检测移除字段', () => {
    const before = { a: 1, b: 2 };
    const after = { a: 1 };
    const diff = computeStateDiff(before, after);
    const removed = diff.find((d) => d.key === 'b');
    expect(removed).toBeDefined();
    expect(removed!.type).toBe('removed');
    expect(removed!.before).toBe(2);
  });

  it('检测变化字段', () => {
    const before = { iteration: 1, tokensUsed: 100 };
    const after = { iteration: 2, tokensUsed: 300 };
    const diff = computeStateDiff(before, after);
    expect(diff.every((d) => d.type === 'changed')).toBe(true);
    const iter = diff.find((d) => d.key === 'iteration')!;
    expect(iter.before).toBe(1);
    expect(iter.after).toBe(2);
  });

  it('检测未变化字段', () => {
    const before = { a: 1, b: [1, 2] };
    const after = { a: 1, b: [1, 2] };
    const diff = computeStateDiff(before, after);
    expect(diff.every((d) => d.type === 'unchanged')).toBe(true);
  });

  it('混合变化', () => {
    const before = { a: 1, b: 2, c: 3 };
    const after = { a: 1, b: 5, d: 4 };
    const diff = computeStateDiff(before, after);

    expect(diff.find((d) => d.key === 'a')!.type).toBe('unchanged');
    expect(diff.find((d) => d.key === 'b')!.type).toBe('changed');
    expect(diff.find((d) => d.key === 'c')!.type).toBe('removed');
    expect(diff.find((d) => d.key === 'd')!.type).toBe('added');
  });

  it('空对象比较', () => {
    const diff = computeStateDiff({}, {});
    expect(diff).toEqual([]);
  });

  it('数组长度变化检测为 changed', () => {
    const before = { items: [1, 2] };
    const after = { items: [1, 2, 3] };
    const diff = computeStateDiff(before, after);
    expect(diff[0].type).toBe('changed');
  });
});
