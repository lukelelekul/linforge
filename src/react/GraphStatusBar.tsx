// GraphStatusBar — 顶部状态栏：绑定进度 + 图验证状态

import React, { useMemo } from 'react';
import type { GraphDefinition } from '../core/types';
import type { RegistryNode } from './EdgeConfigPopover';

export interface GraphStatusBarProps {
  /** Skeleton node key list */
  skeletonKeys: string[];
  /** Registered node list (includes routeKeys) */
  registryNodes: RegistryNode[];
  /** Current graph definition */
  graphDef: GraphDefinition | null;
}

/**
 * Top status bar: binding progress pill + Graph validation badge
 *
 * Validation rules:
 * 1. All non-start/end nodes are bound (no skeleton nodes)
 * 2. All conditional edges have registered routes on their source (no pending conditional edges)
 */
export function GraphStatusBar({
  skeletonKeys,
  registryNodes,
  graphDef,
}: GraphStatusBarProps) {
  const { boundCount, totalCount, isValid } = useMemo(() => {
    if (!graphDef) return { boundCount: 0, totalCount: 0, isValid: false };

    // 非 start/end 节点
    const userNodes = graphDef.nodes.filter((n) => !n.key.startsWith('__'));
    const total = userNodes.length;
    const skeletonCount = skeletonKeys.length;
    const bound = total - skeletonCount;

    // 条件 1：无 skeleton 节点
    const allBound = skeletonCount === 0;

    // 条件 2：所有条件边 source 有注册 routes
    const registryMap = new Map(registryNodes.map((n) => [n.key, n]));
    const conditionalEdges = graphDef.edges.filter(
      (e) => e.routeMap && Object.keys(e.routeMap).length > 0,
    );
    const allRoutesValid = conditionalEdges.every((e) => {
      const reg = registryMap.get(e.source);
      return reg && reg.routeKeys.length > 0;
    });

    return {
      boundCount: bound,
      totalCount: total,
      isValid: total > 0 && allBound && allRoutesValid,
    };
  }, [graphDef, skeletonKeys, registryNodes]);

  if (!graphDef) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {/* 绑定进度 pill */}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 10px',
          borderRadius: 8,
          fontSize: 11,
          fontWeight: 500,
          background: '#f1f5f4',
          color: '#4b6563',
        }}
      >
        <CheckCircleIcon />
        {boundCount}/{totalCount} 节点已绑定
      </span>

      {/* 验证状态 badge */}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 10px',
          borderRadius: 8,
          fontSize: 11,
          fontWeight: 500,
          background: isValid ? '#d1fae5' : '#fee2e2',
          color: isValid ? '#059669' : '#dc2626',
        }}
      >
        {isValid ? <CheckCircleIcon /> : <AlertCircleIcon />}
        {isValid ? 'Graph 有效' : 'Graph 无效'}
      </span>
    </div>
  );
}

// ---- 内联 SVG 图标（12x12） ----

function CheckCircleIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function AlertCircleIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
