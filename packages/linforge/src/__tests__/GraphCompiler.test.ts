import { describe, it, expect, beforeEach } from 'vitest';
import { StateSchema } from '@langchain/langgraph';
import { z } from 'zod/v4';
import { GraphCompiler } from '../core/GraphCompiler';
import { NodeRegistry } from '../core/NodeRegistry';
import { defineNode } from '../core/defineNode';
import { clearStepCounter } from '../core/StepRecorder';
import { MemoryStepPersister } from '../testing/MemoryStepPersister';
import type { GraphDefinition } from '../core/types';

// 简单状态定义
const TestStateSchema = new StateSchema({
  count: z.number().default(0),
  result: z.string().default(''),
});

describe('GraphCompiler', () => {
  let registry: NodeRegistry;
  let compiler: GraphCompiler;

  beforeEach(() => {
    registry = new NodeRegistry();
    compiler = new GraphCompiler(registry);
  });

  it('成功编译包含普通边的图', () => {
    // 注册节点
    registry.registerAll([
      defineNode({
        key: 'step1',
        run: async (s) => ({ count: (s.count as number) + 1 }),
      }),
      defineNode({
        key: 'step2',
        run: async (s) => ({ result: `done:${s.count}` }),
      }),
    ]);

    const graphDef: GraphDefinition = {
      id: 'g1',
      slug: 'simple',
      name: '简单图',
      nodes: [
        { key: '__start__', label: '开始' },
        { key: 'step1', label: '步骤1' },
        { key: 'step2', label: '步骤2' },
        { key: '__end__', label: '结束' },
      ],
      edges: [
        { source: '__start__', target: 'step1' },
        { source: 'step1', target: 'step2' },
        { source: 'step2', target: '__end__' },
      ],
    };

    const result = compiler.compile({
      stateSchema: TestStateSchema,
      graphDef,
    });

    expect(result.graph).toBeDefined();
    expect(result.bindingStatus.bound).toEqual(['step1', 'step2']);
    expect(result.bindingStatus.skeleton).toEqual([]);
  });

  it('skeleton 节点存在时编译失败', () => {
    registry.register(defineNode({ key: 'step1', run: async () => ({}) }));

    const graphDef: GraphDefinition = {
      id: 'g1',
      slug: 'test',
      name: '测试',
      nodes: [
        { key: '__start__', label: '开始' },
        { key: 'step1', label: '步骤1' },
        { key: 'unbound', label: '未绑定' },
        { key: '__end__', label: '结束' },
      ],
      edges: [],
    };

    expect(() =>
      compiler.compile({ stateSchema: TestStateSchema, graphDef }),
    ).toThrowError('未绑定实现');
  });

  it('成功编译条件边', () => {
    registry.registerAll([
      defineNode({
        key: 'router',
        routes: {
          go_a: (s) => (s.count as number) > 5,
          go_b: (s) => (s.count as number) <= 5,
        },
        run: async (s) => ({ count: s.count }),
      }),
      defineNode({
        key: 'nodeA',
        run: async () => ({ result: 'A' }),
      }),
      defineNode({
        key: 'nodeB',
        run: async () => ({ result: 'B' }),
      }),
    ]);

    const graphDef: GraphDefinition = {
      id: 'g1',
      slug: 'conditional',
      name: '条件图',
      nodes: [
        { key: '__start__', label: '开始' },
        { key: 'router', label: '路由' },
        { key: 'nodeA', label: '节点A' },
        { key: 'nodeB', label: '节点B' },
        { key: '__end__', label: '结束' },
      ],
      edges: [
        { source: '__start__', target: 'router' },
        {
          source: 'router',
          target: 'nodeA',
          routeMap: { go_a: 'nodeA', go_b: 'nodeB' },
        },
        { source: 'nodeA', target: '__end__' },
        { source: 'nodeB', target: '__end__' },
      ],
    };

    const result = compiler.compile({
      stateSchema: TestStateSchema,
      graphDef,
    });

    expect(result.graph).toBeDefined();
    expect(result.bindingStatus.bound).toContain('router');
  });

  it('__start__ 和 __end__ 正确转换为 LangGraph 常量', async () => {
    registry.register(
      defineNode({
        key: 'only',
        run: async (s) => ({ count: (s.count as number) + 1 }),
      }),
    );

    const graphDef: GraphDefinition = {
      id: 'g1',
      slug: 'minimal',
      name: '最小图',
      nodes: [
        { key: '__start__', label: '开始' },
        { key: 'only', label: '唯一' },
        { key: '__end__', label: '结束' },
      ],
      edges: [
        { source: '__start__', target: 'only' },
        { source: 'only', target: '__end__' },
      ],
    };

    const { graph } = compiler.compile({
      stateSchema: TestStateSchema,
      graphDef,
    });

    // 编译成功即说明 __start__/__end__ 正确转换
    const result = await graph.invoke({ count: 0 });
    expect(result.count).toBe(1);
  });

  it('条件边路由函数正确执行', async () => {
    registry.registerAll([
      defineNode({
        key: 'decider',
        routes: {
          high: (s) => (s.count as number) > 10,
          low: (s) => (s.count as number) <= 10,
        },
        run: async (s) => ({ count: s.count }),
      }),
      defineNode({
        key: 'highPath',
        run: async () => ({ result: 'high' }),
      }),
      defineNode({
        key: 'lowPath',
        run: async () => ({ result: 'low' }),
      }),
    ]);

    const graphDef: GraphDefinition = {
      id: 'g1',
      slug: 'route-test',
      name: '路由测试',
      nodes: [
        { key: '__start__', label: '开始' },
        { key: 'decider', label: '决策' },
        { key: 'highPath', label: '高' },
        { key: 'lowPath', label: '低' },
        { key: '__end__', label: '结束' },
      ],
      edges: [
        { source: '__start__', target: 'decider' },
        {
          source: 'decider',
          target: 'highPath',
          routeMap: { high: 'highPath', low: 'lowPath' },
        },
        { source: 'highPath', target: '__end__' },
        { source: 'lowPath', target: '__end__' },
      ],
    };

    const { graph } = compiler.compile({
      stateSchema: TestStateSchema,
      graphDef,
    });

    // count=3 应走 low 路径
    const lowResult = await graph.invoke({ count: 3 });
    expect(lowResult.result).toBe('low');

    // count=20 应走 high 路径
    const highResult = await graph.invoke({ count: 20 });
    expect(highResult.result).toBe('high');
  });

  it('stepRecording 自动包装节点并记录步骤', async () => {
    const persister = new MemoryStepPersister();

    registry.registerAll([
      defineNode({
        key: 'step1',
        run: async (s) => ({
          count: (s.count as number) + 1,
          agentRunId: s.agentRunId,
        }),
      }),
      defineNode({
        key: 'step2',
        run: async (s) => ({
          result: `done:${s.count}`,
          agentRunId: s.agentRunId,
        }),
      }),
    ]);

    const graphDef: GraphDefinition = {
      id: 'g1',
      slug: 'record-test',
      name: '记录测试',
      nodes: [
        { key: '__start__', label: '开始' },
        { key: 'step1', label: '步骤1' },
        { key: 'step2', label: '步骤2' },
        { key: '__end__', label: '结束' },
      ],
      edges: [
        { source: '__start__', target: 'step1' },
        { source: 'step1', target: 'step2' },
        { source: 'step2', target: '__end__' },
      ],
    };

    // 需要扩展 state 以包含 agentRunId
    const RecordStateSchema = new StateSchema({
      count: z.number().default(0),
      result: z.string().default(''),
      agentRunId: z.string().default(''),
    });

    const { graph } = compiler.compile({
      stateSchema: RecordStateSchema,
      graphDef,
      stepRecording: { persister },
    });

    await graph.invoke({ count: 0, agentRunId: 'test-run-1' });

    // 等待异步写入
    await new Promise((r) => setTimeout(r, 50));

    const steps = await persister.getSteps('test-run-1');
    expect(steps).toHaveLength(2);
    expect(steps[0].nodeId).toBe('step1');
    expect(steps[1].nodeId).toBe('step2');
    expect(steps[0].stepNumber).toBe(1);
    expect(steps[1].stepNumber).toBe(2);

    clearStepCounter('test-run-1');
  });

  it('stepRecording 自动使用 NodeDefinition.summarizeOutput', async () => {
    const persister = new MemoryStepPersister();

    registry.register(
      defineNode({
        key: 'summarized',
        run: async (s) => ({
          count: (s.count as number) + 10,
          result: 'detailed output',
          agentRunId: s.agentRunId,
        }),
        summarizeOutput: (_input, output) => ({
          summary: true,
          resultLength: (output.result as string)?.length ?? 0,
        }),
      }),
    );

    const graphDef: GraphDefinition = {
      id: 'g1',
      slug: 'summarize-test',
      name: '摘要测试',
      nodes: [
        { key: '__start__', label: '开始' },
        { key: 'summarized', label: '有摘要的节点' },
        { key: '__end__', label: '结束' },
      ],
      edges: [
        { source: '__start__', target: 'summarized' },
        { source: 'summarized', target: '__end__' },
      ],
    };

    const RecordStateSchema = new StateSchema({
      count: z.number().default(0),
      result: z.string().default(''),
      agentRunId: z.string().default(''),
    });

    const { graph } = compiler.compile({
      stateSchema: RecordStateSchema,
      graphDef,
      stepRecording: { persister },
    });

    await graph.invoke({ count: 0, agentRunId: 'test-run-2' });
    await new Promise((r) => setTimeout(r, 50));

    const steps = await persister.getSteps('test-run-2');
    expect(steps).toHaveLength(1);
    expect(steps[0].output).toEqual({
      summary: true,
      resultLength: 15, // 'detailed output'.length
    });

    clearStepCounter('test-run-2');
  });

  it('stateSchema 为 null 时抛出明确错误', () => {
    registry.register(defineNode({ key: 'step1', run: async (s) => s }));

    const graphDef: GraphDefinition = {
      id: 'g-null',
      slug: 'null-schema',
      name: '测试',
      nodes: [
        { key: '__start__', label: '开始' },
        { key: 'step1', label: '步骤' },
        { key: '__end__', label: '结束' },
      ],
      edges: [
        { source: '__start__', target: 'step1' },
        { source: 'step1', target: '__end__' },
      ],
    };

    expect(() =>
      compiler.compile({ stateSchema: null, graphDef }),
    ).toThrowError('stateSchema 为必填项');

    expect(() =>
      compiler.compile({ stateSchema: undefined, graphDef }),
    ).toThrowError('stateSchema 为必填项');
  });
});
