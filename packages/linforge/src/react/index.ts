// @linforge/react — 前端组件

// 类型导出
export type {
  GraphDefinition,
  GraphNodeDef,
  GraphEdgeDef,
  GraphTemplate,
  StepData,
} from '../core/types';

// 组件导出
export { GraphCanvas } from './GraphCanvas';
export type { GraphCanvasProps } from './GraphCanvas';
export { LinforgeNode } from './LinforgeNode';
export { LinforgeTerminalNode } from './LinforgeTerminalNode';
export { ContextMenu } from './ContextMenu';
export { CreateNodeDialog } from './CreateNodeDialog';
export { EdgeConfigPopover } from './EdgeConfigPopover';
export type { EdgeConfigPopoverProps, RegistryNode } from './EdgeConfigPopover';
export { TemplateList } from './TemplateList';
export type { TemplateListProps } from './TemplateList';
export { NodePool } from './NodePool';
export type { NodePoolProps } from './NodePool';

// 运行面板
export { RunPanel } from './RunPanel';
export type {
  RunPanelProps,
  RunPanelSelfManagedProps,
  RunPanelControlledProps,
} from './RunPanel';

// 运行面板子组件（宿主可自定义布局时使用）
export { RunPanelInput } from './RunPanelInput';
export type { RunPanelInputProps } from './RunPanelInput';
export { RunPanelList } from './RunPanelList';
export type { RunPanelListProps } from './RunPanelList';

// 步骤详情面板
export { StepDetailPanel } from './StepDetailPanel';
export type { StepDetailPanelProps } from './StepDetailPanel';

// Prompt 编辑面板
export { PromptEditor } from './PromptEditor';
export type { PromptEditorProps } from './PromptEditor';

// 节点属性编辑面板
export { NodePropertyPanel } from './NodePropertyPanel';
export type { NodePropertyPanelProps, NodeChanges } from './NodePropertyPanel';

// Skeleton 节点引导面板
export { SkeletonNodePanel } from './SkeletonNodePanel';
export type { SkeletonNodePanelProps } from './SkeletonNodePanel';

// 顶部状态栏
export { GraphStatusBar } from './GraphStatusBar';
export type { GraphStatusBarProps } from './GraphStatusBar';

// 内置图标与颜色预设
export { BUILTIN_ICONS, BUILTIN_COLORS, getIconById } from './icons';
export type { LinforgeIcon, LinforgeColor, IconComponent } from './icons';

// State diff 工具
export { computeStateDiff } from './stateDiff';
export type { DiffEntry, DiffType } from './stateDiff';

// 工具函数
export { buildLayout } from './graphLayout';
export {
  formatDuration,
  formatTokens,
  formatRelativeTime,
} from './formatUtils';

// 一体化工作台
export { LinforgeWorkbench } from './LinforgeWorkbench';
export type { LinforgeWorkbenchProps } from './LinforgeWorkbench';

// 图列表视图
export { GraphListView } from './GraphListView';
export type { GraphListViewProps } from './GraphListView';

// 图画布视图
export { GraphStudioView } from './GraphStudioView';
export type { GraphStudioViewProps } from './GraphStudioView';

// 创建 / 编辑弹窗
export { CreateGraphDialog } from './CreateGraphDialog';
export type { CreateGraphDialogProps } from './CreateGraphDialog';
export { EditGraphDialog } from './EditGraphDialog';
export type { EditGraphDialogProps } from './EditGraphDialog';

// 内部路由 Hook
export { useInternalRouter } from './useInternalRouter';
export type { UseInternalRouterReturn } from './useInternalRouter';

// 图列表 CRUD Hook
export { useLinforgeGraphList } from './useLinforgeGraphList';
export type {
  GraphListItem,
  CreateGraphInput,
  UpdateGraphInput,
  UseLinforgeGraphListReturn,
} from './useLinforgeGraphList';

// Hook
export { useLinforgeGraph } from './useLinforgeGraph';
export type {
  UseLinforgeGraphOptions,
  UseLinforgeGraphReturn,
} from './useLinforgeGraph';
export { useLinforgeRuns } from './useLinforgeRuns';
export type {
  ReplayStep,
  UseLinforgeRunsOptions,
  UseLinforgeRunsReturn,
} from './useLinforgeRuns';
export { useLinforgePrompt } from './useLinforgePrompt';
export type {
  PromptVersionData,
  UseLinforgePromptOptions,
  UseLinforgePromptReturn,
} from './useLinforgePrompt';
