import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RunManager } from '../core/RunManager';
import { MemoryRunStore } from '../testing/MemoryRunStore';

// 模拟 Runnable — 可控的异步执行
function createMockGraph(options?: {
  delay?: number;
  result?: unknown;
  error?: Error;
}) {
  const { delay = 10, result = { done: true }, error } = options ?? {};

  return {
    invoke: vi.fn(async (_input: unknown, opts?: { signal?: AbortSignal }) => {
      // 检查 abort
      if (opts?.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          if (error) reject(error);
          else resolve();
        }, delay);

        // 监听 abort 信号
        opts?.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });

      return result;
    }),
  };
}

describe('RunManager', () => {
  let manager: RunManager;
  let store: MemoryRunStore;

  beforeEach(() => {
    manager = new RunManager();
    store = new MemoryRunStore();
  });

  it('startRun 后台执行并更新状态为 completed', async () => {
    const graph = createMockGraph({ delay: 10 });

    manager.startRun(graph as any, {
      runId: 'run-1',
      graphSlug: 'test-graph',
      input: { count: 0 },
      store,
    });

    expect(manager.isRunning('run-1')).toBe(true);

    // 等待执行完成
    await new Promise((r) => setTimeout(r, 50));

    expect(manager.isRunning('run-1')).toBe(false);
    const run1 = await store.getRun('run-1');
    expect(run1?.status).toBe('completed');
  });

  it('执行失败时状态变为 failed', async () => {
    const graph = createMockGraph({
      delay: 10,
      error: new Error('模拟错误'),
    });

    const onFailed = vi.fn();

    manager.startRun(graph as any, {
      runId: 'run-2',
      graphSlug: 'test-graph',
      input: {},
      store,
      callbacks: { onFailed },
    });

    await new Promise((r) => setTimeout(r, 50));

    const run2 = await store.getRun('run-2');
    expect(run2?.status).toBe('failed');
    expect(run2?.result).toMatchObject({ error: '模拟错误' });
    expect(onFailed).toHaveBeenCalledOnce();
  });

  it('abortRun 取消正在执行的运行', async () => {
    const graph = createMockGraph({ delay: 500 });

    manager.startRun(graph as any, {
      runId: 'run-3',
      graphSlug: 'test-graph',
      input: {},
      store,
    });

    expect(manager.isRunning('run-3')).toBe(true);
    const aborted = manager.abortRun('run-3');
    expect(aborted).toBe(true);

    await new Promise((r) => setTimeout(r, 50));

    expect(manager.isRunning('run-3')).toBe(false);
    const run3 = await store.getRun('run-3');
    expect(run3?.status).toBe('cancelled');
  });

  it('abortRun 对不存在的 runId 返回 false', () => {
    expect(manager.abortRun('nonexistent')).toBe(false);
  });

  it('重复 runId 抛出异常', () => {
    const graph = createMockGraph({ delay: 500 });

    manager.startRun(graph as any, {
      runId: 'run-4',
      graphSlug: 'test-graph',
      input: {},
    });

    expect(() =>
      manager.startRun(graph as any, {
        runId: 'run-4',
        graphSlug: 'test-graph',
        input: {},
      }),
    ).toThrowError('已在执行中');

    manager.abortRun('run-4');
  });

  it('getRunningIds 返回所有运行中的 ID', () => {
    const graph = createMockGraph({ delay: 500 });

    manager.startRun(graph as any, {
      runId: 'a',
      graphSlug: 'test-graph',
      input: {},
    });
    manager.startRun(graph as any, {
      runId: 'b',
      graphSlug: 'test-graph',
      input: {},
    });

    expect(manager.getRunningIds()).toEqual(['a', 'b']);
    expect(manager.runningCount).toBe(2);

    manager.abortRun('a');
    manager.abortRun('b');
  });

  it('isRunning 正确反映状态', async () => {
    const graph = createMockGraph({ delay: 10 });

    expect(manager.isRunning('run-5')).toBe(false);

    manager.startRun(graph as any, {
      runId: 'run-5',
      graphSlug: 'test-graph',
      input: {},
    });

    expect(manager.isRunning('run-5')).toBe(true);

    await new Promise((r) => setTimeout(r, 50));

    expect(manager.isRunning('run-5')).toBe(false);
  });

  it('onCompleted 回调在成功时调用', async () => {
    const graph = createMockGraph({ delay: 10, result: { answer: 42 } });
    const onCompleted = vi.fn();

    manager.startRun(graph as any, {
      runId: 'run-6',
      graphSlug: 'test-graph',
      input: {},
      callbacks: { onCompleted },
    });

    await new Promise((r) => setTimeout(r, 50));

    expect(onCompleted).toHaveBeenCalledWith('run-6', { answer: 42 });
  });

  it('metadata 透传到 RunRecord', async () => {
    const graph = createMockGraph({ delay: 10 });

    manager.startRun(graph as any, {
      runId: 'run-meta',
      graphSlug: 'test-graph',
      input: { instruction: '测试' },
      store,
      metadata: { userId: 'user-123', tenantId: 'org-456' },
    });

    await new Promise((r) => setTimeout(r, 50));

    const run = await store.getRun('run-meta');
    expect(run?.metadata).toEqual({ userId: 'user-123', tenantId: 'org-456' });
  });

  it('未传 metadata 时 RunRecord 不含 metadata 字段', async () => {
    const graph = createMockGraph({ delay: 10 });

    manager.startRun(graph as any, {
      runId: 'run-no-meta',
      graphSlug: 'test-graph',
      input: { instruction: '测试' },
      store,
    });

    await new Promise((r) => setTimeout(r, 50));

    const run = await store.getRun('run-no-meta');
    expect(run?.metadata).toBeUndefined();
  });
});
