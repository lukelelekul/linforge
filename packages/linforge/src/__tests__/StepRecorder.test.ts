import { describe, it, expect, beforeEach } from 'vitest';
import { withStepRecording, clearStepCounter } from '../core/StepRecorder';
import { MemoryStepPersister } from '../testing/MemoryStepPersister';

describe('StepRecorder', () => {
  let persister: MemoryStepPersister;

  beforeEach(() => {
    persister = new MemoryStepPersister();
  });

  const makeState = (runId: string, extra: Record<string, unknown> = {}) => ({
    agentRunId: runId,
    tokensUsed: 0,
    ...extra,
  });

  it('withStepRecording 包装节点并记录步骤', async () => {
    const nodeFn = async (state: Record<string, unknown>) => ({
      result: 'done',
      tokensUsed: (state.tokensUsed as number) + 100,
    });

    const wrapped = withStepRecording('planner', nodeFn, { persister });
    const result = await wrapped(makeState('run-1'));

    expect(result).toEqual({ result: 'done', tokensUsed: 100 });

    // 等待异步写入
    await new Promise((r) => setTimeout(r, 10));

    const steps = await persister.getSteps('run-1');
    expect(steps).toHaveLength(1);
    expect(steps[0].nodeId).toBe('planner');
    expect(steps[0].stepNumber).toBe(1);
    expect(steps[0].tokensUsed).toBe(100);
    expect(steps[0].durationMs).toBeGreaterThanOrEqual(0);

    clearStepCounter('run-1');
  });

  it('stepNumber 递增', async () => {
    const nodeFn = async () => ({});
    const wrapped = withStepRecording('nodeA', nodeFn, { persister });

    await wrapped(makeState('run-2'));
    await wrapped(makeState('run-2'));
    await wrapped(makeState('run-2'));

    await new Promise((r) => setTimeout(r, 10));

    const steps = await persister.getSteps('run-2');
    expect(steps.map((s) => s.stepNumber)).toEqual([1, 2, 3]);

    clearStepCounter('run-2');
  });

  it('clearStepCounter 重置计数', async () => {
    const nodeFn = async () => ({});
    const wrapped = withStepRecording('nodeB', nodeFn, { persister });

    await wrapped(makeState('run-3'));
    clearStepCounter('run-3');
    await wrapped(makeState('run-3'));

    await new Promise((r) => setTimeout(r, 10));

    const steps = await persister.getSteps('run-3');
    // 清除后从 1 重新开始
    expect(steps[1].stepNumber).toBe(1);

    clearStepCounter('run-3');
  });

  it('记录输入摘要（数组字段 → count）', async () => {
    const nodeFn = async () => ({});
    const wrapped = withStepRecording('nodeC', nodeFn, { persister });

    await wrapped(
      makeState('run-4', {
        items: [1, 2, 3],
        iteration: 5,
      }),
    );

    await new Promise((r) => setTimeout(r, 10));

    const steps = await persister.getSteps('run-4');
    expect(steps[0].input).toMatchObject({
      iteration: 5,
      tokensUsed: 0,
      itemsCount: 3,
    });

    clearStepCounter('run-4');
  });

  it('计算 token delta', async () => {
    const nodeFn = async () => ({ tokensUsed: 250 });
    const wrapped = withStepRecording('nodeD', nodeFn, { persister });

    await wrapped(makeState('run-5', { tokensUsed: 100 }));

    await new Promise((r) => setTimeout(r, 10));

    const steps = await persister.getSteps('run-5');
    expect(steps[0].tokensUsed).toBe(150); // 250 - 100

    clearStepCounter('run-5');
  });

  it('异常时记录错误信息并重新抛出', async () => {
    const nodeFn = async () => {
      throw new Error('boom');
    };
    const wrapped = withStepRecording('nodeE', nodeFn, { persister });

    await expect(wrapped(makeState('run-6'))).rejects.toThrowError('boom');

    await new Promise((r) => setTimeout(r, 10));

    const steps = await persister.getSteps('run-6');
    expect(steps).toHaveLength(1);
    expect(steps[0].output).toEqual({ error: 'boom' });
    expect(steps[0].tokensUsed).toBe(0);

    clearStepCounter('run-6');
  });

  it('无 runId 时跳过记录直接执行', async () => {
    const nodeFn = async (): Promise<Record<string, unknown>> => ({
      result: 'ok',
    });
    const wrapped = withStepRecording('nodeF', nodeFn, { persister });

    // 不传 agentRunId
    const result = await wrapped({ tokensUsed: 0 });
    expect(result).toEqual({ result: 'ok' });

    await new Promise((r) => setTimeout(r, 10));

    // 无任何步骤记录
    expect(await persister.getSteps('')).toEqual([]);
  });

  it('debug 模式记录 stateBefore 和 stateAfter', async () => {
    const nodeFn = async (state: Record<string, unknown>) => ({
      tokensUsed: (state.tokensUsed as number) + 200,
      iteration: (state.iteration as number) + 1,
    });

    const wrapped = withStepRecording('planner', nodeFn, {
      persister,
      debug: true,
    });

    await wrapped(
      makeState('run-debug-1', { iteration: 1, items: ['a', 'b'] }),
    );
    await new Promise((r) => setTimeout(r, 10));

    const steps = await persister.getSteps('run-debug-1');
    expect(steps).toHaveLength(1);
    expect(steps[0].stateBefore).toBeDefined();
    expect(steps[0].stateAfter).toBeDefined();
    // stateBefore 应包含原始值
    expect(steps[0].stateBefore!.iteration).toBe(1);
    expect(steps[0].stateBefore!.tokensUsed).toBe(0);
    // stateAfter 应包含合并后的值
    expect(steps[0].stateAfter!.iteration).toBe(2);
    expect(steps[0].stateAfter!.tokensUsed).toBe(200);
    // 数组保持原样
    expect(steps[0].stateAfter!.items).toEqual(['a', 'b']);

    clearStepCounter('run-debug-1');
  });

  it('非 debug 模式不记录快照', async () => {
    const nodeFn = async (
      _state: Record<string, unknown>,
    ): Promise<Record<string, unknown>> => ({ result: 'ok' });
    const wrapped = withStepRecording('nodeX', nodeFn, { persister });

    await wrapped(makeState('run-no-debug'));
    await new Promise((r) => setTimeout(r, 10));

    const steps = await persister.getSteps('run-no-debug');
    expect(steps[0].stateBefore).toBeUndefined();
    expect(steps[0].stateAfter).toBeUndefined();

    clearStepCounter('run-no-debug');
  });

  it('debug 模式异常时仍记录 stateBefore', async () => {
    const nodeFn = async () => {
      throw new Error('debug-boom');
    };
    const wrapped = withStepRecording('nodeY', nodeFn, {
      persister,
      debug: true,
    });

    await expect(
      wrapped(makeState('run-debug-err', { iteration: 5 })),
    ).rejects.toThrowError('debug-boom');

    await new Promise((r) => setTimeout(r, 10));

    const steps = await persister.getSteps('run-debug-err');
    expect(steps).toHaveLength(1);
    expect(steps[0].stateBefore).toBeDefined();
    expect(steps[0].stateBefore!.iteration).toBe(5);
    // 异常时无 stateAfter
    expect(steps[0].stateAfter).toBeUndefined();

    clearStepCounter('run-debug-err');
  });

  it('自定义 runIdKey', async () => {
    const nodeFn = async () => ({});
    const wrapped = withStepRecording('nodeH', nodeFn, {
      persister,
      runIdKey: 'myRunId',
    });

    await wrapped({ myRunId: 'custom-run', tokensUsed: 0 });
    await new Promise((r) => setTimeout(r, 10));

    const steps = await persister.getSteps('custom-run');
    expect(steps).toHaveLength(1);

    clearStepCounter('custom-run');
  });
});
