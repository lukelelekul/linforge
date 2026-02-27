// Data mapping layer: GraphDefinition -> React Flow nodes/edges

import type { Node, Edge } from '@xyflow/react';
import type { GraphDefinition, GraphNodeDef } from '../core/types';

/** Auto-layout parameters */
const LAYOUT = {
  startX: 80,
  startY: 200,
  gapX: 280,
  gapY: 120,
  maxCols: 4,
};

/** Check if a node is a terminal node */
function isTerminal(node: GraphNodeDef): boolean {
  return (
    node.nodeType === 'start' ||
    node.nodeType === 'end' ||
    node.key === '__start__' ||
    node.key === '__end__'
  );
}

/** Auto-calculate node positions (left-to-right grid layout) */
function autoPosition(index: number): { x: number; y: number } {
  const col = index % LAYOUT.maxCols;
  const row = Math.floor(index / LAYOUT.maxCols);
  return {
    x: LAYOUT.startX + col * LAYOUT.gapX,
    y: LAYOUT.startY + row * LAYOUT.gapY,
  };
}

/** Mapping of registered node route keys */
export type RouteKeysMap = Map<string, string[]>;

/** Convert GraphDefinition to React Flow nodes and edges */
export function buildLayout(
  graphDef: GraphDefinition,
  skeletonKeys: string[] = [],
  routeKeysMap: RouteKeysMap = new Map(),
): {
  nodes: Node[];
  edges: Edge[];
} {
  const skeletonSet = new Set(skeletonKeys);

  const nodes: Node[] = graphDef.nodes.map((nodeDef, index) => {
    const terminal = isTerminal(nodeDef);
    const position = nodeDef.position || autoPosition(index);

    return {
      id: nodeDef.key,
      type: terminal ? 'terminal' : 'linforgeNode',
      position,
      data: {
        label: nodeDef.label,
        description: nodeDef.description || '',
        icon: nodeDef.icon,
        color: nodeDef.color,
        nodeKey: nodeDef.key,
        nodeType: nodeDef.nodeType,
        metadata: nodeDef.metadata,
        hasPrompt: nodeDef.hasPrompt,
        isStart: nodeDef.key === '__start__' || nodeDef.nodeType === 'start',
        isSkeleton: skeletonSet.has(nodeDef.key),
      },
    };
  });

  // 统计每个 source 的出边数，用于检测 fan-out（并行分支）
  const sourceOutCount = new Map<string, number>();
  for (const e of graphDef.edges) {
    sourceOutCount.set(e.source, (sourceOutCount.get(e.source) || 0) + 1);
  }

  const edges: Edge[] = graphDef.edges.map((edgeDef, index) => {
    const isConditional =
      edgeDef.routeMap && Object.keys(edgeDef.routeMap).length > 0;

    // 并行分支：同一 source 有 ≥2 条非条件出边
    const isFanOut =
      !isConditional && (sourceOutCount.get(edgeDef.source) || 0) >= 2;

    // 判断 pending 状态：有 routeMap 但 source 节点未注册 routes
    const sourceRoutes = routeKeysMap.get(edgeDef.source);
    const isPending =
      isConditional && (!sourceRoutes || sourceRoutes.length === 0);

    // 并行边：紫色虚线；条件边：琥珀/灰色虚线；普通边：青绿实线
    const edgeColor = isFanOut
      ? '#8b5cf6'
      : isConditional
        ? isPending
          ? '#9ca3af'
          : '#f59e0b'
        : '#2dd4bf';
    const edgeStyle: Record<string, unknown> = {
      stroke: edgeColor,
      strokeWidth: 2,
    };
    if (isConditional || isFanOut) {
      edgeStyle.strokeDasharray = '6 3';
    }

    return {
      id: `e-${edgeDef.source}-${edgeDef.target}-${index}`,
      source: edgeDef.source,
      target: edgeDef.target,
      sourceHandle: edgeDef.sourceHandle,
      targetHandle: edgeDef.targetHandle,
      type: 'smoothstep',
      animated: false,
      label: edgeDef.label,
      data: {
        routeMap: edgeDef.routeMap,
      },
      markerEnd: { type: 'arrowclosed' as const, color: edgeColor },
      style: edgeStyle,
    };
  });

  return { nodes, edges };
}
