import type { GraphTemplate } from './types';

/** ReAct Agent — tool-calling Agent with conditional routing loop */
export const reactAgentTemplate: GraphTemplate = {
  id: 'react-agent',
  name: 'ReAct Agent',
  description: '工具调用型 Agent，planner 自主选择工具，循环采集直到满足条件',
  category: 'agent',
  nodes: [
    {
      key: 'planner',
      label: 'Planner',
      description: 'LLM 规划并选择工具',
      icon: 'sparkles',
    },
    {
      key: 'tools',
      label: 'Tools',
      description: '执行工具调用',
      icon: 'wrench',
    },
    {
      key: 'processResults',
      label: 'Process Results',
      description: '提取和处理工具返回结果',
      icon: 'file-text',
    },
    {
      key: 'checkLimits',
      label: 'Check Limits',
      description: '检查迭代次数和 token 预算',
      icon: 'alert-circle',
    },
  ],
  edges: [
    {
      source: 'planner',
      target: 'tools',
      label: '有 tool_calls',
      routeMap: {
        has_tool_calls: 'tools',
        text_response: 'checkLimits',
      },
    },
    { source: 'tools', target: 'processResults' },
    { source: 'processResults', target: 'checkLimits' },
    {
      source: 'checkLimits',
      target: 'planner',
      label: '继续',
      routeMap: {
        continue: 'planner',
        done: '__end__',
      },
    },
  ],
};

/** Pipeline — linear processing pipeline */
export const pipelineTemplate: GraphTemplate = {
  id: 'pipeline',
  name: 'Pipeline',
  description: '线性处理管线，数据依次经过各阶段处理',
  category: 'pipeline',
  nodes: [
    {
      key: 'step1',
      label: 'Step 1',
      description: '第一阶段处理',
      icon: 'play',
    },
    {
      key: 'step2',
      label: 'Step 2',
      description: '第二阶段处理',
      icon: 'activity',
    },
    {
      key: 'step3',
      label: 'Step 3',
      description: '第三阶段处理',
      icon: 'activity',
    },
    {
      key: 'save',
      label: 'Save',
      description: '保存结果',
      icon: 'download',
    },
  ],
  edges: [
    { source: 'step1', target: 'step2' },
    { source: 'step2', target: 'step3' },
    { source: 'step3', target: 'save' },
  ],
};

/** Map-Reduce — parallel processing (requires fan-out/fan-in compiler support, not yet available) */
export const mapReduceTemplate: GraphTemplate = {
  id: 'map-reduce',
  name: 'Map-Reduce',
  description: '拆分任务并行处理，合并结果输出',
  category: 'pattern',
  disabled: true,
  nodes: [
    {
      key: 'split',
      label: 'Split',
      description: '拆分任务为子任务',
      icon: 'git-branch',
    },
    {
      key: 'worker1',
      label: 'Worker 1',
      description: '并行处理子任务 1',
      icon: 'cpu',
    },
    {
      key: 'worker2',
      label: 'Worker 2',
      description: '并行处理子任务 2',
      icon: 'cpu',
    },
    {
      key: 'merge',
      label: 'Merge',
      description: '合并处理结果',
      icon: 'git-merge',
    },
    {
      key: 'output',
      label: 'Output',
      description: '输出最终结果',
      icon: 'download',
    },
  ],
  edges: [
    { source: 'split', target: 'worker1' },
    { source: 'split', target: 'worker2' },
    { source: 'worker1', target: 'merge' },
    { source: 'worker2', target: 'merge' },
    { source: 'merge', target: 'output' },
  ],
};

/** Human-in-the-loop — manual review (requires interrupt mechanism, not yet available) */
export const humanInTheLoopTemplate: GraphTemplate = {
  id: 'human-in-the-loop',
  name: 'Human-in-the-loop',
  description: '需要人工审核的流程，支持批准/拒绝分支',
  category: 'pattern',
  disabled: true,
  nodes: [
    {
      key: 'agent',
      label: 'Agent',
      description: 'AI 处理生成结果',
      icon: 'sparkles',
    },
    {
      key: 'review',
      label: 'Review',
      description: '人工审核',
      icon: 'eye',
    },
    {
      key: 'approve',
      label: 'Approve',
      description: '批准后处理',
      icon: 'check-circle-2',
    },
    {
      key: 'reject',
      label: 'Reject',
      description: '拒绝后修正',
      icon: 'x-circle',
    },
  ],
  edges: [
    { source: 'agent', target: 'review' },
    {
      source: 'review',
      target: 'approve',
      label: '批准',
      routeMap: {
        approved: 'approve',
        rejected: 'reject',
      },
    },
    { source: 'reject', target: 'agent' },
  ],
};

/** All built-in templates */
export const builtinTemplates: GraphTemplate[] = [
  reactAgentTemplate,
  pipelineTemplate,
  mapReduceTemplate,
  humanInTheLoopTemplate,
];
