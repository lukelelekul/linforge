import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { StepData } from 'linforge/core';
import { PrismaStepPersister } from '../PrismaStepPersister';
import { createTestPrisma, cleanDatabase } from './helpers';

const prisma = createTestPrisma();
let store: PrismaStepPersister;

const sampleStep: StepData = {
  agentRunId: 'run-1',
  nodeId: 'planner',
  stepNumber: 1,
  input: { messages: ['hello'] },
  output: { plan: 'step1' },
  durationMs: 120,
  tokensUsed: 50,
};

beforeAll(async () => {
  store = new PrismaStepPersister(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await cleanDatabase(prisma);
});

describe('PrismaStepPersister', () => {
  it('createStep + getSteps 基本读写', async () => {
    await store.createStep(sampleStep);
    const steps = await store.getSteps('run-1');
    expect(steps).toHaveLength(1);
    expect(steps[0].nodeId).toBe('planner');
    expect(steps[0].input).toEqual({ messages: ['hello'] });
    expect(steps[0].output).toEqual({ plan: 'step1' });
  });

  it('getSteps 按 stepNumber 升序排列', async () => {
    await store.createStep({ ...sampleStep, stepNumber: 3, nodeId: 'c' });
    await store.createStep({ ...sampleStep, stepNumber: 1, nodeId: 'a' });
    await store.createStep({ ...sampleStep, stepNumber: 2, nodeId: 'b' });
    const steps = await store.getSteps('run-1');
    expect(steps.map((s) => s.stepNumber)).toEqual([1, 2, 3]);
    expect(steps.map((s) => s.nodeId)).toEqual(['a', 'b', 'c']);
  });

  it('getSteps 空 run 返回空数组', async () => {
    const steps = await store.getSteps('nonexistent');
    expect(steps).toEqual([]);
  });

  it('不同 run 的 steps 互不影响', async () => {
    await store.createStep(sampleStep);
    await store.createStep({ ...sampleStep, agentRunId: 'run-2', nodeId: 'tools' });
    const steps1 = await store.getSteps('run-1');
    const steps2 = await store.getSteps('run-2');
    expect(steps1).toHaveLength(1);
    expect(steps2).toHaveLength(1);
    expect(steps2[0].nodeId).toBe('tools');
  });

  it('toolName 可选字段', async () => {
    await store.createStep({ ...sampleStep, toolName: 'search' });
    const steps = await store.getSteps('run-1');
    expect(steps[0].toolName).toBe('search');
  });

  it('stateBefore/stateAfter 可选字段', async () => {
    await store.createStep({
      ...sampleStep,
      stateBefore: { count: 0 },
      stateAfter: { count: 1 },
    });
    const steps = await store.getSteps('run-1');
    expect(steps[0].stateBefore).toEqual({ count: 0 });
    expect(steps[0].stateAfter).toEqual({ count: 1 });
  });
});
