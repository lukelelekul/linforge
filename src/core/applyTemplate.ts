import type {
  GraphTemplate,
  GraphDefinition,
  GraphNodeDef,
  GraphEdgeDef,
} from './types';

/** Auto-layout parameters */
const LAYOUT = {
  /** Column gap */
  gapX: 280,
  /** Row gap */
  gapY: 140,
  /** Default starting position */
  startX: 100,
  startY: 100,
};

/** Return value of applyTemplate */
export interface ApplyTemplateResult {
  /** Merged complete graph definition */
  graph: GraphDefinition;
  /** Mapping of renamed keys (original key -> actual key) */
  renamedKeys: Record<string, string>;
}

/**
 * Apply a template to a graph definition (append-merge)
 *
 * - Empty graph: directly populate with template content
 * - Non-empty graph: template nodes appended to the right of existing nodes
 * - Key conflicts: automatically add numeric suffix
 * - START/END: template's __start__ / __end__ edges are removed in append mode
 */
export function applyTemplate(
  template: GraphTemplate,
  existing: GraphDefinition,
): ApplyTemplateResult {
  const isEmpty =
    existing.nodes.filter((n) => !n.key.startsWith('__')).length === 0;

  // 收集已有 key（含 __start__、__end__）
  const existingKeys = new Set(existing.nodes.map((n) => n.key));

  // 解决 key 冲突：生成唯一 key + 记录重命名映射
  const renamedKeys: Record<string, string> = {};
  const resolveKey = (originalKey: string): string => {
    if (!existingKeys.has(originalKey)) {
      existingKeys.add(originalKey);
      return originalKey;
    }
    let suffix = 2;
    while (existingKeys.has(`${originalKey}_${suffix}`)) {
      suffix++;
    }
    const newKey = `${originalKey}_${suffix}`;
    existingKeys.add(newKey);
    renamedKeys[originalKey] = newKey;
    return newKey;
  };

  // 映射模板 key → 实际 key
  const keyMap = new Map<string, string>();
  for (const node of template.nodes) {
    keyMap.set(node.key, resolveKey(node.key));
  }

  // 计算模板节点的自动布局位置
  const layers = computeLayers(template);
  const positions = layoutLayers(layers, existing, isEmpty);

  // 生成 GraphNodeDef
  const newNodes: GraphNodeDef[] = template.nodes.map((tn) => {
    const actualKey = keyMap.get(tn.key)!;
    return {
      key: actualKey,
      label: tn.label,
      description: tn.description,
      icon: tn.icon,
      color: tn.color,
      position: positions.get(tn.key),
    };
  });

  // 生成 GraphEdgeDef（追加模式下过滤掉连接 __start__/__end__ 的边）
  const newEdges: GraphEdgeDef[] = [];
  for (const te of template.edges) {
    const sourceKey = keyMap.get(te.source);
    const targetKey = keyMap.get(te.target);

    // 模板边的 source/target 不在模板节点中（如 __start__/__end__），追加模式下跳过
    if (!sourceKey || !targetKey) {
      if (!isEmpty) continue; // 追加模式：跳过
      // 空画布模式：也跳过（START/END 由画布自行管理）
      continue;
    }

    const edge: GraphEdgeDef = {
      source: sourceKey,
      target: targetKey,
      label: te.label,
    };

    // 条件边：重映射 routeMap 中的 target key
    if (te.routeMap) {
      const mappedRouteMap: Record<string, string> = {};
      for (const [routeKey, targetNodeKey] of Object.entries(te.routeMap)) {
        mappedRouteMap[routeKey] = keyMap.get(targetNodeKey) || targetNodeKey;
      }
      edge.routeMap = mappedRouteMap;
    }

    newEdges.push(edge);
  }

  return {
    graph: {
      id: existing.id,
      slug: existing.slug,
      name: existing.name,
      nodes: [...existing.nodes, ...newNodes],
      edges: [...existing.edges, ...newEdges],
    },
    renamedKeys,
  };
}

/**
 * Topological sort into layers — assign template nodes to layers by dependency
 * Returns layers[i] = list of node keys in that layer
 *
 * Back-edge detection: uses the declaration order of the template nodes array as reference.
 * If an edge's target is declared before its source, it is treated as a back-edge (cycle)
 * and excluded from in-degree calculation. This allows cyclic templates (e.g. ReAct) to be
 * layered correctly.
 */
function computeLayers(template: GraphTemplate): string[][] {
  const nodeKeys = new Set(template.nodes.map((n) => n.key));

  // 节点声明顺序索引（用于检测回边）
  const nodeOrder = new Map<string, number>();
  template.nodes.forEach((n, i) => nodeOrder.set(n.key, i));

  /** Determine if source -> target is a back-edge (target declared before source) */
  const isBackEdge = (source: string, target: string): boolean => {
    const si = nodeOrder.get(source);
    const ti = nodeOrder.get(target);
    if (si === undefined || ti === undefined) return false;
    return ti <= si;
  };

  // 构建邻接表和入度（只考虑模板内部的前向边）
  const inDegree = new Map<string, number>();
  const children = new Map<string, string[]>();
  for (const key of nodeKeys) {
    inDegree.set(key, 0);
    children.set(key, []);
  }

  for (const edge of template.edges) {
    if (!nodeKeys.has(edge.source) || !nodeKeys.has(edge.target)) continue;

    // 主 target
    if (!isBackEdge(edge.source, edge.target)) {
      children.get(edge.source)!.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }

    // 条件边的额外 target
    if (edge.routeMap) {
      for (const target of Object.values(edge.routeMap)) {
        if (nodeKeys.has(target) && target !== edge.target) {
          if (!isBackEdge(edge.source, target)) {
            children.get(edge.source)!.push(target);
            inDegree.set(target, (inDegree.get(target) || 0) + 1);
          }
        }
      }
    }
  }

  // BFS 分层（Kahn 算法）
  const layers: string[][] = [];
  let queue = [...nodeKeys].filter((k) => inDegree.get(k) === 0);

  // 无入度节点为空时（全是环），按声明顺序排列
  if (queue.length === 0) {
    return [template.nodes.map((n) => n.key)];
  }

  while (queue.length > 0) {
    layers.push([...queue]);
    const nextQueue: string[] = [];
    for (const key of queue) {
      for (const child of children.get(key) || []) {
        const newDegree = (inDegree.get(child) || 1) - 1;
        inDegree.set(child, newDegree);
        if (newDegree === 0) {
          nextQueue.push(child);
        }
      }
    }
    queue = nextQueue;
  }

  // 处理环中的剩余节点：追加到最后一层
  const placed = new Set(layers.flat());
  const remaining = [...nodeKeys].filter((k) => !placed.has(k));
  if (remaining.length > 0) {
    layers.push(remaining);
  }

  return layers;
}

/**
 * Compute positions based on layer results
 * - Empty canvas: start from the top-left corner
 * - Append mode: place in the empty area to the right of existing nodes
 */
function layoutLayers(
  layers: string[][],
  existing: GraphDefinition,
  isEmpty: boolean,
): Map<string, { x: number; y: number }> {
  // 计算起始 X 位置
  let startX = LAYOUT.startX;
  if (!isEmpty && existing.nodes.length > 0) {
    const maxX = Math.max(
      ...existing.nodes.filter((n) => n.position).map((n) => n.position!.x),
      0,
    );
    startX = maxX + LAYOUT.gapX + 100; // 已有节点最右边 + 间距
  }

  const positions = new Map<string, { x: number; y: number }>();

  for (let col = 0; col < layers.length; col++) {
    const layer = layers[col];
    // 垂直居中排列
    const totalHeight = (layer.length - 1) * LAYOUT.gapY;
    const offsetY = LAYOUT.startY - totalHeight / 2;

    for (let row = 0; row < layer.length; row++) {
      positions.set(layer[row], {
        x: startX + col * LAYOUT.gapX,
        y: offsetY + row * LAYOUT.gapY,
      });
    }
  }

  return positions;
}
