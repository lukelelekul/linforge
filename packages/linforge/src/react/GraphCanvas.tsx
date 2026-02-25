// GraphCanvas — Linforge 可编辑画布主组件

import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  type OnConnect,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  BackgroundVariant,
  type XYPosition,
  useReactFlow,
  ReactFlowProvider,
  ConnectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type {
  GraphDefinition,
  GraphNodeDef,
  GraphEdgeDef,
} from '../core/types';
import type { ReplayStep } from './useLinforgeRuns';
import { buildLayout, type RouteKeysMap } from './graphLayout';
import { LinforgeNode } from './LinforgeNode';
import { LinforgeTerminalNode } from './LinforgeTerminalNode';
import { ContextMenu } from './ContextMenu';
import { CreateNodeDialog } from './CreateNodeDialog';
import { EdgeConfigPopover, type RegistryNode } from './EdgeConfigPopover';

/** Node type registry */
const nodeTypes = {
  linforgeNode: LinforgeNode,
  terminal: LinforgeTerminalNode,
};

/** Handle CSS: visually hidden but always interactive, shown when selected */
const HANDLE_CSS = `
/* 默认：视觉隐藏，但始终可交互（pointer-events: all） */
.react-flow__handle {
  width: 12px !important;
  height: 12px !important;
  background: #0d9488 !important;
  border: 2px solid #fff !important;
  border-radius: 50% !important;
  box-shadow: 0 0 0 1px #0d9488 !important;
  opacity: 0 !important;
  pointer-events: all !important;
  transition: opacity 0.15s, box-shadow 0.15s !important;
}
/* 选中节点时显示 handle */
.react-flow__node.selected .react-flow__handle {
  opacity: 1 !important;
}
/* 连线拖拽中：所有 handle 显示 */
.react-flow.connecting .react-flow__handle {
  opacity: 1 !important;
}
/* Terminal 节点 handle 稍大 */
.react-flow__node[data-id="__start__"] .react-flow__handle,
.react-flow__node[data-id="__end__"] .react-flow__handle {
  width: 14px !important;
  height: 14px !important;
}
/* hover handle：发光效果 */
.react-flow__handle:hover {
  opacity: 1 !important;
  box-shadow: 0 0 0 4px rgba(20, 184, 166, 0.3), 0 0 0 1px #0d9488 !important;
  background: #14b8a6 !important;
  cursor: crosshair;
}
/* 边选中：保留原色，仅加粗 + 中性发光 */
.react-flow__edge.selected .react-flow__edge-path {
  stroke-width: 3px !important;
  filter: drop-shadow(0 0 6px rgba(0, 0, 0, 0.15)) !important;
}
.react-flow__edge.selected .react-flow__edge-interaction {
  stroke-width: 20px !important;
}
`;

/** Replay mode pulse animation CSS */
const REPLAY_CSS = `
@keyframes linforge-pulse {
  0%, 100% { box-shadow: 0 0 8px rgba(59, 130, 246, 0.3); }
  50% { box-shadow: 0 0 16px rgba(59, 130, 246, 0.5), 0 0 24px rgba(59, 130, 246, 0.2); }
}
.linforge-pulse-node {
  animation: linforge-pulse 2s ease-in-out infinite;
}
`;

export interface GraphCanvasProps {
  /** Graph definition data */
  graphDef: GraphDefinition;
  /** List of node keys without code implementation (skeleton nodes) */
  skeletonKeys?: string[];
  /** Registered node list (includes routeKeys, used for edge configuration) */
  registryNodes?: RegistryNode[];
  /** Save callback */
  onSave?: (graphDef: GraphDefinition) => void;
  /** Node click callback (nodeData contains label, metadata, and other canvas node data) */
  onNodeClick?: (nodeKey: string, nodeData?: Record<string, unknown>) => void;
  /** Whether the canvas is editable (default true) */
  editable?: boolean;
  /** Canvas mode: blueprint (editing) or replay (playback) */
  mode?: 'blueprint' | 'replay';
  /** Replay step data; when provided, nodes highlight based on execution status */
  replaySteps?: ReplayStep[];
  /** Pane click callback (can be used to close the right panel) */
  onPaneClick?: () => void;
}

/** Build GraphDefinition from React Flow nodes/edges (reverse mapping) */
function toGraphDef(
  base: GraphDefinition,
  nodes: Node[],
  edges: Edge[],
): GraphDefinition {
  const graphNodes: GraphNodeDef[] = nodes.map((n) => {
    const d = n.data as Record<string, unknown>;
    // terminal 节点仍走 key 判断，其余保留 data 中的原始 nodeType
    const nodeType =
      n.id === '__start__'
        ? 'start'
        : n.id === '__end__'
          ? 'end'
          : (d.nodeType as string | undefined) || 'node';
    return {
      key: n.id,
      label: d.label as string,
      description: d.description as string | undefined,
      icon: d.icon as string | undefined,
      color: d.color as string | undefined,
      position: n.position,
      nodeType,
      hasPrompt: d.hasPrompt as boolean | undefined,
      metadata: d.metadata as Record<string, unknown> | undefined,
    };
  });

  const graphEdges: GraphEdgeDef[] = edges.map((e) => ({
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle || undefined,
    targetHandle: e.targetHandle || undefined,
    label: e.label as string | undefined,
    routeMap: (e.data as Record<string, unknown>)?.routeMap as
      | Record<string, string>
      | undefined,
  }));

  return {
    ...base,
    nodes: graphNodes,
    edges: graphEdges,
  };
}

/** Default edge style */
const DEFAULT_EDGE_STYLE = {
  type: 'smoothstep' as const,
  markerEnd: { type: 'arrowclosed' as const, color: '#2dd4bf' },
  style: { stroke: '#2dd4bf', strokeWidth: 2 },
};

const EMPTY_SKELETON_KEYS: string[] = [];
const EMPTY_REGISTRY_NODES: RegistryNode[] = [];

const EMPTY_REPLAY_STEPS: ReplayStep[] = [];

function GraphCanvasInner({
  graphDef,
  skeletonKeys = EMPTY_SKELETON_KEYS,
  registryNodes = EMPTY_REGISTRY_NODES,
  onSave,
  onNodeClick,
  editable = true,
  mode = 'blueprint',
  replaySteps = EMPTY_REPLAY_STEPS,
  onPaneClick: onPaneClickProp,
}: GraphCanvasProps) {
  const isReplay = mode === 'replay';
  // Replay 模式下强制禁用编辑
  const effectiveEditable = isReplay ? false : editable;
  const { screenToFlowPosition } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    flowPosition: XYPosition;
  } | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const pendingPosition = useRef<XYPosition>({ x: 0, y: 0 });

  // 边配置弹出框状态
  const [edgePopover, setEdgePopover] = useState<{
    edge: Edge;
    position: { x: number; y: number };
  } | null>(null);

  // 构建 registryNodes 查找 Map
  const registryMap = useMemo(() => {
    const map = new Map<string, RegistryNode>();
    for (const rn of registryNodes) {
      map.set(rn.key, rn);
    }
    return map;
  }, [registryNodes]);

  // 构建 routeKeysMap 供 buildLayout 区分 pending/active 条件边
  const routeKeysMap: RouteKeysMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const rn of registryNodes) {
      map.set(rn.key, rn.routeKeys);
    }
    return map;
  }, [registryNodes]);

  // 注入 Handle hover CSS
  useEffect(() => {
    const styleId = 'linforge-handle-hover';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = HANDLE_CSS;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, []);

  // 注入 Replay 脉冲动画 CSS
  useEffect(() => {
    if (!isReplay) return;
    const styleId = 'linforge-replay-css';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = REPLAY_CSS;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, [isReplay]);

  // 构建 replaySteps 查找 Map
  const replayMap = useMemo(() => {
    const map = new Map<string, ReplayStep>();
    for (const step of replaySteps) {
      map.set(step.nodeKey, step);
    }
    return map;
  }, [replaySteps]);

  // 统一同步：graphDef + replay 状态一次性计算，避免两阶段渲染抖动
  useEffect(() => {
    const layout = buildLayout(graphDef, skeletonKeys, routeKeysMap);

    if (!isReplay || replayMap.size === 0) {
      // Blueprint 模式或无 replay 数据：直接使用原始 layout
      setNodes(layout.nodes);
      setEdges(layout.edges);
      return;
    }

    // Replay 模式：一次性注入节点状态
    const allDone = [...replayMap.values()].every(
      (s) => s.status === 'completed',
    );

    const replayNodes = layout.nodes.map((n) => {
      if (n.id === '__start__') {
        return { ...n, data: { ...n.data, replayStatus: 'completed' } };
      }
      if (n.id === '__end__') {
        return {
          ...n,
          data: { ...n.data, replayStatus: allDone ? 'completed' : 'idle' },
        };
      }
      const step = replayMap.get(n.id);
      return {
        ...n,
        data: {
          ...n.data,
          replayStatus: step?.status || 'idle',
          replayDuration: step?.durationMs,
          replayTokens: step?.tokensUsed,
        },
      };
    });

    // 一次性注入边动画
    const executedNodes = new Set(replayMap.keys());
    executedNodes.add('__start__');
    if (allDone) executedNodes.add('__end__');

    const replayEdges = layout.edges.map((e) => {
      const isExecuted =
        executedNodes.has(e.source) && executedNodes.has(e.target);
      return {
        ...e,
        animated: isExecuted,
        style: {
          ...e.style,
          opacity: isExecuted ? 1 : 0.3,
        },
      };
    });

    setNodes(replayNodes);
    setEdges(replayEdges);
  }, [
    graphDef,
    skeletonKeys,
    routeKeysMap,
    isReplay,
    replayMap,
    setNodes,
    setEdges,
  ]);

  // 保存辅助函数
  const triggerSave = useCallback(
    (currentNodes: Node[], currentEdges: Edge[]) => {
      if (!onSave) return;
      onSave(toGraphDef(graphDef, currentNodes, currentEdges));
    },
    [graphDef, onSave],
  );

  // 节点变化 → 拖拽结束或删除时保存
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      const hasDragEnd = changes.some(
        (c) => c.type === 'position' && !c.dragging,
      );
      const hasRemove = changes.some((c) => c.type === 'remove');
      if ((hasDragEnd || hasRemove) && effectiveEditable) {
        setTimeout(() => {
          setNodes((nds) => {
            setEdges((eds) => {
              triggerSave(nds, eds);
              return eds;
            });
            return nds;
          });
        }, 0);
      }
    },
    [onNodesChange, effectiveEditable, triggerSave, setNodes, setEdges],
  );

  // 连线校验
  const isValidConnection = useCallback(
    (connection: { source: string | null; target: string | null }) => {
      const { source, target } = connection;
      if (!source || !target) return false;
      // 不能自连
      if (source === target) return false;
      // START 只能作为起点
      if (target === '__start__') return false;
      // END 只能作为终点
      if (source === '__end__') return false;
      // 不能重复边
      const duplicate = edges.some(
        (e) => e.source === source && e.target === target,
      );
      if (duplicate) return false;
      return true;
    },
    [edges],
  );

  // 连线
  const onConnect: OnConnect = useCallback(
    (params) => {
      if (!effectiveEditable) return;
      setEdges((eds) => {
        const newEdges = addEdge(
          {
            ...params,
            ...DEFAULT_EDGE_STYLE,
          },
          eds,
        );
        setTimeout(() => {
          setNodes((nds) => {
            triggerSave(nds, newEdges);
            return nds;
          });
        }, 0);
        return newEdges;
      });
    },
    [effectiveEditable, setEdges, setNodes, triggerSave],
  );

  // 删除
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);
      const hasRemove = changes.some((c) => c.type === 'remove');
      if (hasRemove && effectiveEditable) {
        setTimeout(() => {
          setEdges((eds) => {
            setNodes((nds) => {
              triggerSave(nds, eds);
              return nds;
            });
            return eds;
          });
        }, 0);
      }
    },
    [onEdgesChange, effectiveEditable, setEdges, setNodes, triggerSave],
  );

  // 节点点击
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeClick?.(node.id, node.data as Record<string, unknown>);
    },
    [onNodeClick],
  );

  // 右键菜单
  const handlePaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      if (!effectiveEditable) return;
      event.preventDefault();
      const flowPos = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        flowPosition: flowPos,
      });
    },
    [effectiveEditable, screenToFlowPosition],
  );

  // 关闭右键菜单和边配置弹出框，取消节点选中
  const handlePaneClick = useCallback(() => {
    setContextMenu(null);
    setEdgePopover(null);
    setNodes((nds) =>
      nds.map((n) => ({ ...n, data: { ...n.data, edgeHighlight: false } })),
    );
    onPaneClickProp?.();
  }, [setNodes, onPaneClickProp]);

  // 打开单条边的配置弹出框
  const openEdgeConfig = useCallback(
    (edge: Edge, pos: { x: number; y: number }) => {
      setEdgePopover({ edge, position: pos });
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: {
            ...n.data,
            edgeHighlight: n.id === edge.source || n.id === edge.target,
          },
        })),
      );
      // 同步 React Flow 边选中状态
      setEdges((eds) =>
        eds.map((e) => ({
          ...e,
          selected: e.id === edge.id,
        })),
      );
    },
    [setNodes, setEdges],
  );

  // 边点击 → 直接打开配置弹出框
  const handleEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      if (!effectiveEditable) return;
      openEdgeConfig(edge, { x: event.clientX, y: event.clientY });
    },
    [effectiveEditable, openEdgeConfig],
  );

  // 边配置保存
  const handleEdgeConfigSave = useCallback(
    (
      edgeId: string,
      updates: { label?: string; routeMap?: Record<string, string> },
    ) => {
      setEdges((eds) => {
        const newEdges = eds.map((e) => {
          if (e.id !== edgeId) return e;

          const isConditional =
            updates.routeMap && Object.keys(updates.routeMap).length > 0;
          const sourceRoutes = routeKeysMap.get(e.source);
          const isPending =
            isConditional && (!sourceRoutes || sourceRoutes.length === 0);
          const edgeColor = isConditional
            ? isPending
              ? '#9ca3af'
              : '#f59e0b'
            : '#2dd4bf';

          return {
            ...e,
            label: updates.label,
            data: {
              ...(e.data as Record<string, unknown>),
              routeMap: updates.routeMap,
            },
            style: {
              stroke: edgeColor,
              strokeWidth: 2,
              ...(isConditional ? { strokeDasharray: '6 3' } : {}),
            },
            markerEnd: { type: 'arrowclosed' as const, color: edgeColor },
          };
        });

        setTimeout(() => {
          setNodes((nds) => {
            triggerSave(nds, newEdges);
            return nds;
          });
        }, 0);

        return newEdges;
      });
      setEdgePopover(null);
      // 取消节点选中
      setNodes((nds) =>
        nds.map((n) => ({ ...n, data: { ...n.data, edgeHighlight: false } })),
      );
    },
    [setEdges, setNodes, triggerSave, routeKeysMap],
  );

  // 右键菜单 → 自定义节点（弹窗输入 key + label）
  const handleAddCustomNode = useCallback(() => {
    if (!contextMenu) return;
    pendingPosition.current = contextMenu.flowPosition;
    setContextMenu(null);
    setShowCreateDialog(true);
  }, [contextMenu]);

  // 右键菜单 → 已注册节点（直接创建，无弹窗）
  const handleAddRegisteredNode = useCallback(
    (nodeKey: string, label: string) => {
      if (!contextMenu) return;
      const position = contextMenu.flowPosition;
      setContextMenu(null);
      const newNode: Node = {
        id: nodeKey,
        type: 'linforgeNode',
        position,
        data: {
          label,
          description: '',
          nodeKey,
          isSkeleton: false,
        },
      };
      setNodes((nds) => {
        const updated = [...nds, newNode];
        setTimeout(() => {
          triggerSave(updated, edges);
        }, 0);
        return updated;
      });
    },
    [contextMenu, setNodes, edges, triggerSave],
  );

  // 创建节点确认
  const handleCreateNode = useCallback(
    (nodeKey: string, label: string) => {
      setShowCreateDialog(false);
      const newNode: Node = {
        id: nodeKey,
        type: 'linforgeNode',
        position: pendingPosition.current,
        data: {
          label,
          description: '',
          nodeKey,
          isSkeleton: true,
        },
      };
      setNodes((nds) => {
        const updated = [...nds, newNode];
        setTimeout(() => {
          triggerSave(updated, edges);
        }, 0);
        return updated;
      });
    },
    [setNodes, edges, triggerSave],
  );

  // 已有节点 key 列表（用于冲突检测）
  const existingKeys = useMemo(() => nodes.map((n) => n.id), [nodes]);

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneContextMenu={handlePaneContextMenu}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        nodesDraggable={effectiveEditable}
        nodesConnectable={effectiveEditable}
        elementsSelectable={effectiveEditable}
        deleteKeyCode={effectiveEditable ? ['Backspace', 'Delete'] : []}
        proOptions={{ hideAttribution: true }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        isValidConnection={isValidConnection}
        connectionMode={ConnectionMode.Loose}
        connectionRadius={20}
        connectionLineStyle={{ stroke: '#2dd4bf', strokeWidth: 2 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls />
      </ReactFlow>

      {/* 右键菜单（节点池） */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          registryNodes={registryNodes}
          existingKeys={existingKeys}
          skeletonKeys={skeletonKeys}
          onAddRegisteredNode={handleAddRegisteredNode}
          onAddCustomNode={handleAddCustomNode}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* 创建节点弹窗 */}
      {showCreateDialog && (
        <CreateNodeDialog
          existingKeys={existingKeys}
          onConfirm={handleCreateNode}
          onCancel={() => setShowCreateDialog(false)}
        />
      )}

      {/* 边配置弹出框 */}
      {edgePopover && (
        <EdgeConfigPopover
          key={edgePopover.edge.id}
          edge={edgePopover.edge}
          position={edgePopover.position}
          sourceRouteKeys={
            registryMap.get(edgePopover.edge.source)?.routeKeys || []
          }
          usedRouteKeys={(() => {
            const used = new Set<string>();
            for (const e of edges) {
              if (
                e.source === edgePopover.edge.source &&
                e.id !== edgePopover.edge.id
              ) {
                const rm = (e.data as Record<string, unknown>)?.routeMap as
                  | Record<string, string>
                  | undefined;
                if (rm) {
                  // 只算 value === e.target 的条目（过滤脏数据）
                  for (const [key, val] of Object.entries(rm)) {
                    if (val === e.target) used.add(key);
                  }
                }
              }
            }
            return used;
          })()}
          onSave={handleEdgeConfigSave}
          onClose={() => {
            setEdgePopover(null);
            setNodes((nds) =>
              nds.map((n) => ({
                ...n,
                data: { ...n.data, edgeHighlight: false },
              })),
            );
          }}
        />
      )}
    </div>
  );
}

/** GraphCanvas wrapped with ReactFlowProvider */
export function GraphCanvas(props: GraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
