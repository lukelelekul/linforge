// GraphStudioView — Linforge 画布编辑视图（无 router 依赖，纯内联样式）

import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  createElement,
} from 'react';
import { GraphCanvas } from './GraphCanvas';
import { GraphStatusBar } from './GraphStatusBar';
import { NodePool } from './NodePool';
import { NodePropertyPanel } from './NodePropertyPanel';
import { RunPanelInput } from './RunPanelInput';
import { RunPanelList } from './RunPanelList';
import { SkeletonNodePanel } from './SkeletonNodePanel';
import { StepDetailPanel } from './StepDetailPanel';
import { TemplateList } from './TemplateList';
import { useLinforgeGraph } from './useLinforgeGraph';
import { useLinforgeRuns } from './useLinforgeRuns';
import { IconArrowLeft, IconChevronRight, IconX } from './icons';
import type { GraphNodeDef } from '../core/types';

/** NodeChanges type accepted by NodePropertyPanel */
export type NodeChanges = Partial<
  Pick<GraphNodeDef, 'label' | 'description' | 'icon' | 'color'>
>;

export interface GraphStudioViewProps {
  /** Graph slug identifier */
  slug: string;
  /** API prefix (e.g. '/api/linforge') */
  apiBase: string;
  /** Callback to navigate back to list */
  onBack: () => void;
  /** Prompt placeholder docs per node */
  promptPlaceholders?: Record<string, string[]>;
  /** Binding steps for unbound (skeleton) nodes */
  skeletonBindingSteps?: string[];
}

type TabId = 'blueprint' | 'run';

export function GraphStudioView({
  slug,
  apiBase,
  onBack,
  promptPlaceholders,
  skeletonBindingSteps,
}: GraphStudioViewProps) {
  const {
    graphDef,
    skeletonKeys,
    registryNodes,
    templates,
    loading,
    error,
    saveGraph,
    applyTemplate,
  } = useLinforgeGraph({ slug, apiBase });

  const runsData = useLinforgeRuns({ apiBase, slug });
  const {
    runs,
    selectedRunId,
    replaySteps,
    selectedStepNodeKey,
    selectStepNode,
    selectedStepDetail,
    loadSnapshots,
    selectRun,
    hasRunning,
    triggerRun,
  } = runsData;

  const canvasMode = selectedRunId ? 'replay' : 'blueprint';

  // Tab 切换 + 面板折叠
  const [activeTab, setActiveTab] = useState<TabId>('blueprint');
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  // 选中运行记录时自动切到运行调试 Tab
  useEffect(() => {
    if (selectedRunId) setActiveTab('run');
  }, [selectedRunId]);

  // 切到 Blueprint Tab 时退出回放状态
  useEffect(() => {
    if (activeTab === 'blueprint' && selectedRunId) {
      selectRun(null);
      selectStepNode(null);
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // blueprint 模式选中的节点
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);

  const selectedNode = useMemo(
    () => graphDef?.nodes.find((n) => n.key === selectedNodeKey) ?? null,
    [graphDef, selectedNodeKey],
  );

  const isSelectedSkeleton = useMemo(
    () => !!selectedNodeKey && skeletonKeys.includes(selectedNodeKey),
    [selectedNodeKey, skeletonKeys],
  );

  const handleNodeClick = useCallback(
    (key: string) => {
      // terminal 节点（__start__ / __end__）不打开右侧面板
      if (key.startsWith('__')) return;
      if (canvasMode === 'replay') {
        selectStepNode(key);
        loadSnapshots();
      } else {
        setSelectedNodeKey(key);
      }
    },
    [canvasMode, selectStepNode, loadSnapshots],
  );

  const handlePaneClick = useCallback(() => {
    setSelectedNodeKey(null);
    selectStepNode(null);
  }, [selectStepNode]);

  const handleNodeChange = useCallback(
    (nodeKey: string, changes: NodeChanges) => {
      if (!graphDef || !saveGraph) return;
      const updatedNodes = graphDef.nodes.map((n) =>
        n.key === nodeKey ? { ...n, ...changes } : n,
      );
      saveGraph({ ...graphDef, nodes: updatedNodes });
    },
    [graphDef, saveGraph],
  );

  const existingKeys = useMemo(
    () => graphDef?.nodes.map((n) => n.key) || [],
    [graphDef],
  );

  const graphNodes = useMemo(
    () =>
      graphDef?.nodes
        .filter((n) => !n.key.startsWith('__'))
        .map((n) => ({ key: n.key, label: n.label })) || [],
    [graphDef],
  );

  const isCanvasEmpty = useMemo(
    () =>
      !graphDef ||
      graphDef.nodes.filter((n) => !n.key.startsWith('__')).length === 0,
    [graphDef],
  );

  // 模板选择
  const [renameNotice, setRenameNotice] = useState<string | null>(null);
  const handleTemplateSelect = useCallback(
    async (templateId: string) => {
      setRenameNotice(null);
      if (!applyTemplate) return;
      try {
        const { renamedKeys } = await applyTemplate(templateId);
        if (renamedKeys && Object.keys(renamedKeys).length > 0) {
          const items = Object.entries(renamedKeys)
            .map(([from, to]) => `${from} → ${to}`)
            .join('、');
          setRenameNotice(`节点已重命名：${items}`);
          setTimeout(() => setRenameNotice(null), 5000);
        }
      } catch {
        // 错误由 hook 层处理
      }
    },
    [applyTemplate],
  );

  const handleAddNode = useCallback(
    (nodeKey: string, label: string) => {
      if (!graphDef || !saveGraph) return;
      const maxX = Math.max(...graphDef.nodes.map((n) => n.position?.x || 0));
      saveGraph({
        ...graphDef,
        nodes: [
          ...graphDef.nodes,
          {
            key: nodeKey,
            label,
            nodeType: 'node',
            position: { x: maxX + 280, y: 200 },
          },
        ],
      });
    },
    [graphDef, saveGraph],
  );

  const handleTriggerRun = useCallback(
    async (instruction: string) => triggerRun(instruction),
    [triggerRun],
  );

  // 加载状态
  if (loading) {
    return createElement(
      'div',
      {
        style: {
          display: 'flex',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#8da5a2',
          fontSize: 13,
        },
      },
      '加载中...',
    );
  }

  if (error) {
    return createElement(
      'div',
      {
        style: {
          display: 'flex',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#dc2626',
          fontSize: 13,
        },
      },
      `加载失败: ${error}`,
    );
  }

  if (!graphDef) {
    return createElement(
      'div',
      {
        style: {
          display: 'flex',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#8da5a2',
          fontSize: 13,
        },
      },
      '图数据不存在',
    );
  }

  return createElement(
    'div',
    { style: { display: 'flex', flexDirection: 'column', height: '100%' } },

    // ---- 顶栏 ----
    createElement(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #e2e8e7',
          background: '#fff',
          padding: '10px 24px',
        },
      },
      createElement(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: 8 } },
        createElement(
          'button',
          {
            onClick: onBack,
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              color: '#4b6563',
              padding: 0,
            },
          },
          IconArrowLeft({ size: 14 }),
          'Linforge',
        ),
        IconChevronRight({ size: 14, color: '#c5d5d3' }),
        createElement(
          'span',
          { style: { fontSize: 15, fontWeight: 600, color: '#0f1d1b' } },
          graphDef.name || slug,
        ),
      ),
      createElement(GraphStatusBar, {
        skeletonKeys,
        registryNodes,
        graphDef,
      }),
    ),

    // ---- 主区域：左面板 + 画布 + 右面板 ----
    createElement(
      'div',
      { style: { display: 'flex', flex: 1, overflow: 'hidden' } },

      // 左面板
      !panelCollapsed &&
        createElement(
          'div',
          {
            style: {
              width: 280,
              flexShrink: 0,
              borderRight: '1px solid #e2e8e7',
              background: '#fff',
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
            },
          },
          // Tab 栏
          createElement(
            'div',
            {
              style: {
                display: 'flex',
                alignItems: 'center',
                borderBottom: '1px solid #e2e8e7',
                padding: '0 8px',
                flexShrink: 0,
              },
            },
            createElement(TabButton, {
              label: 'Blueprint',
              active: activeTab === 'blueprint',
              onClick: () => setActiveTab('blueprint'),
            }),
            createElement(TabButton, {
              label: '运行调试',
              active: activeTab === 'run',
              onClick: () => setActiveTab('run'),
            }),
            // 收起按钮
            createElement(
              'button',
              {
                onClick: () => setPanelCollapsed(true),
                title: '收起面板',
                style: {
                  marginLeft: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  border: 'none',
                  background: 'transparent',
                  color: '#8da5a2',
                  cursor: 'pointer',
                },
                onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
                  e.currentTarget.style.background = '#f1f5f4';
                  e.currentTarget.style.color = '#0f1d1b';
                },
                onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#8da5a2';
                },
              },
              createElement('svg', {
                width: 16,
                height: 16,
                viewBox: '0 0 24 24',
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: 2,
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
                dangerouslySetInnerHTML: {
                  __html:
                    '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m16 15-3-3 3-3"/>',
                },
              }),
            ),
          ),
          // Tab 内容
          createElement(
            'div',
            {
              style: {
                flex: 1,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              },
            },
            activeTab === 'blueprint' &&
              createElement(BlueprintTabContent, {
                templates,
                isCanvasEmpty,
                onTemplateSelect: handleTemplateSelect,
                registryNodes,
                existingKeys,
                skeletonKeys,
                graphNodes,
                onAddNode: handleAddNode,
                onNodeClick: handleNodeClick,
                renameNotice,
                onDismissNotice: () => setRenameNotice(null),
              }),
            activeTab === 'run' &&
              createElement(RunTabContent, {
                runs,
                selectedRunId,
                onSelectRun: selectRun,
                onTrigger: handleTriggerRun,
                hasRunning,
              }),
          ),
        ),

      // 画布
      createElement(
        'div',
        { style: { position: 'relative', flex: 1 } },

        // 面板展开按钮
        panelCollapsed &&
          createElement(
            'button',
            {
              onClick: () => setPanelCollapsed(false),
              style: {
                position: 'absolute',
                top: 12,
                left: 12,
                zIndex: 5,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 10,
                border: '1px solid #e2e8e7',
                background: '#fff',
                fontSize: 12,
                fontWeight: 500,
                color: '#4b6563',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                transition: 'all 0.15s',
              },
              onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
                e.currentTarget.style.borderColor = '#0d9488';
                e.currentTarget.style.color = '#0d9488';
              },
              onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
                e.currentTarget.style.borderColor = '#e2e8e7';
                e.currentTarget.style.color = '#4b6563';
              },
            },
            createElement('svg', {
              width: 14,
              height: 14,
              viewBox: '0 0 24 24',
              fill: 'none',
              stroke: 'currentColor',
              strokeWidth: 2,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              dangerouslySetInnerHTML: {
                __html:
                  '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m14 9 3 3-3 3"/>',
              },
            }),
            '面板',
          ),

        // 退出回放按钮
        canvasMode === 'replay' &&
          createElement(
            'button',
            {
              onClick: () => {
                selectRun(null);
                selectStepNode(null);
              },
              style: {
                position: 'absolute',
                top: 12,
                right: 12,
                zIndex: 5,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 10,
                border: '1px solid #e2e8e7',
                background: '#fff',
                fontSize: 12,
                fontWeight: 500,
                color: '#4b6563',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                transition: 'all 0.15s',
              },
              onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
                e.currentTarget.style.borderColor = '#dc2626';
                e.currentTarget.style.color = '#dc2626';
              },
              onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
                e.currentTarget.style.borderColor = '#e2e8e7';
                e.currentTarget.style.color = '#4b6563';
              },
            },
            IconX({ size: 14 }),
            '退出回放',
          ),

        createElement(GraphCanvas, {
          graphDef,
          skeletonKeys,
          registryNodes,
          onSave: saveGraph,
          onNodeClick: handleNodeClick,
          onPaneClick: handlePaneClick,
          mode: canvasMode,
          replaySteps,
        }),
      ),

      // 右侧面板
      canvasMode === 'replay' &&
        selectedStepDetail &&
        createElement(StepDetailPanel, {
          step: selectedStepDetail,
          onClose: () => selectStepNode(null),
          onLoadSnapshots: loadSnapshots,
        }),
      canvasMode === 'blueprint' &&
        selectedNode &&
        isSelectedSkeleton &&
        createElement(SkeletonNodePanel, {
          nodeKey: selectedNode.key,
          node: selectedNode,
          onClose: () => setSelectedNodeKey(null),
          bindingSteps: skeletonBindingSteps,
        }),
      canvasMode === 'blueprint' &&
        selectedNode &&
        !isSelectedSkeleton &&
        createElement(NodePropertyPanel, {
          nodeKey: selectedNode.key,
          node: selectedNode,
          apiBase,
          onNodeChange: handleNodeChange,
          onClose: () => setSelectedNodeKey(null),
          promptPlaceholders: promptPlaceholders,
        }),
    ),
  );
}

// ---- 辅助组件 ----

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return createElement(
    'button',
    {
      type: 'button',
      onClick,
      style: {
        padding: '10px 12px',
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        color: active ? '#0d9488' : '#8da5a2',
        background: 'none',
        border: 'none',
        borderBottom: active ? '2px solid #0d9488' : '2px solid transparent',
        cursor: 'pointer',
        transition: 'all 0.15s',
        marginBottom: -1,
      },
      onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
        if (!active) e.currentTarget.style.color = '#4b6563';
      },
      onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
        if (!active) e.currentTarget.style.color = '#8da5a2';
      },
    },
    label,
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return createElement(
    'div',
    {
      style: {
        fontSize: 10,
        fontWeight: 600,
        color: '#8da5a2',
        letterSpacing: '0.08em',
        textTransform: 'uppercase' as const,
        marginBottom: 8,
      },
    },
    children,
  );
}

function BlueprintTabContent(props: {
  templates: any[];
  isCanvasEmpty: boolean;
  onTemplateSelect: (id: string) => void;
  registryNodes: any[];
  existingKeys: string[];
  skeletonKeys: string[];
  graphNodes: Array<{ key: string; label: string }>;
  onAddNode: (key: string, label: string) => void;
  onNodeClick: (key: string) => void;
  renameNotice: string | null;
  onDismissNotice: () => void;
}) {
  return createElement(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      },
    },
    // 固定区
    createElement(
      'div',
      { style: { flexShrink: 0, padding: '12px 12px 0' } },
      // 重命名提示
      props.renameNotice &&
        createElement(
          'div',
          {
            style: {
              padding: '8px 10px',
              borderRadius: 8,
              background: '#fffbeb',
              border: '1px solid #fde68a',
              fontSize: 11,
              color: '#92400e',
              marginBottom: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            },
          },
          createElement('span', { style: { flex: 1 } }, props.renameNotice),
          createElement(
            'button',
            {
              onClick: props.onDismissNotice,
              style: {
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#92400e',
                fontSize: 13,
                padding: '0 2px',
                lineHeight: 1,
              },
            },
            '×',
          ),
        ),
      createElement(SectionLabel, null, '模板'),
      createElement(TemplateList, {
        templates: props.templates,
        isCanvasEmpty: props.isCanvasEmpty,
        onSelect: props.onTemplateSelect,
      }),
      createElement('div', {
        style: { height: 1, background: '#e2e8e7', margin: '14px 0 0' },
      }),
    ),
    // 滚动区
    createElement(
      'div',
      { style: { flex: 1, overflowY: 'auto', padding: '12px 12px' } },
      createElement(SectionLabel, null, '节点池'),
      createElement(NodePool, {
        registryNodes: props.registryNodes,
        existingKeys: props.existingKeys,
        skeletonKeys: props.skeletonKeys,
        graphNodes: props.graphNodes,
        onAddNode: props.onAddNode,
        onNodeClick: props.onNodeClick,
      }),
    ),
  );
}

function RunTabContent(props: {
  runs: any[];
  selectedRunId: string | null;
  onSelectRun: (id: string | null) => void;
  onTrigger: (instruction: string) => Promise<string>;
  hasRunning: boolean;
}) {
  return createElement(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        padding: '12px 12px 0',
      },
    },
    createElement(
      'div',
      { style: { flexShrink: 0 } },
      createElement(RunPanelInput, {
        onTrigger: props.onTrigger,
        disabled: props.hasRunning,
      }),
    ),
    createElement(
      'div',
      { style: { flex: 1, overflowY: 'auto', marginTop: 14 } },
      createElement(RunPanelList, {
        runs: props.runs,
        selectedRunId: props.selectedRunId,
        onSelect: props.onSelectRun,
      }),
    ),
  );
}
