// NodePool — 节点池列表（侧栏适配，纯内联样式）

import { useState, useMemo } from 'react';

export interface NodePoolProps {
  /** Registered node list */
  registryNodes: Array<{ key: string; label?: string }>;
  /** List of node keys already on the canvas */
  existingKeys: string[];
  /** List of skeleton (unbound code implementation) node keys */
  skeletonKeys?: string[];
  /** Non-start/end nodes on canvas (for displaying custom nodes not in registry) */
  graphNodes?: Array<{ key: string; label: string }>;
  /** Click node not on canvas -> add it */
  onAddNode: (nodeKey: string, label: string) => void;
  /** Click node on canvas -> view details (select canvas node) */
  onNodeClick?: (nodeKey: string) => void;
}

// ---- 内联样式 ----

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  overflow: 'hidden',
};

const emptyStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#8da5a2',
  padding: '8px 0',
};

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: 'none',
  background: 'none',
  textAlign: 'left',
  cursor: 'pointer',
  transition: 'background 0.1s',
};

const itemOnCanvasStyle: React.CSSProperties = {
  ...itemStyle,
  opacity: 0.55,
};

const dotStyle = (color: string): React.CSSProperties => ({
  width: 7,
  height: 7,
  borderRadius: '50%',
  background: color,
  flexShrink: 0,
});

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: '#0f1d1b',
  lineHeight: 1.3,
};

const keyStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#8da5a2',
  fontFamily: 'monospace',
  marginLeft: 'auto',
  flexShrink: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: '45%',
  textAlign: 'right',
};

const sectionDividerStyle: React.CSSProperties = {
  height: 1,
  background: '#e2e8e7',
  margin: '6px 0',
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: '#8da5a2',
  letterSpacing: '0.05em',
  textTransform: 'uppercase' as const,
  padding: '4px 10px 2px',
};

export function NodePool({
  registryNodes,
  existingKeys,
  skeletonKeys,
  graphNodes,
  onAddNode,
  onNodeClick,
}: NodePoolProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const existingSet = useMemo(() => new Set(existingKeys), [existingKeys]);
  const skeletonSet = useMemo(
    () => new Set(skeletonKeys || []),
    [skeletonKeys],
  );
  const registryKeySet = useMemo(
    () => new Set(registryNodes.map((rn) => rn.key)),
    [registryNodes],
  );

  // 画布上不在 registry 中的自定义节点
  const customNodes = useMemo(
    () => (graphNodes || []).filter((n) => !registryKeySet.has(n.key)),
    [graphNodes, registryKeySet],
  );

  if (registryNodes.length === 0 && customNodes.length === 0) {
    return <div style={emptyStyle}>暂无已注册节点</div>;
  }

  return (
    <div style={containerStyle}>
      {registryNodes.map((rn) => {
        const isOnCanvas = existingSet.has(rn.key);
        const isSkeleton = skeletonSet.has(rn.key);
        // 绑定状态：在画布上且非 skeleton = bound（绿），skeleton = 灰，不在画布 = 浅灰
        const dotColor = isOnCanvas
          ? isSkeleton
            ? '#9ca3af'
            : '#0d9488'
          : '#d5e0de';
        const label = rn.label || rn.key;

        return (
          <button
            key={rn.key}
            type="button"
            style={{
              ...(isOnCanvas ? itemOnCanvasStyle : itemStyle),
              background: hoveredKey === rn.key ? '#f0fdfa' : 'none',
            }}
            onMouseEnter={() => setHoveredKey(rn.key)}
            onMouseLeave={() => setHoveredKey(null)}
            onClick={() => {
              if (isOnCanvas) {
                onNodeClick?.(rn.key);
              } else {
                onAddNode(rn.key, label);
              }
            }}
          >
            <span style={dotStyle(dotColor)} />
            <span style={labelStyle}>{label}</span>
            <span style={keyStyle}>{rn.key}</span>
          </button>
        );
      })}

      {/* 画布上的自定义节点（不在 registry 中） */}
      {customNodes.length > 0 && (
        <>
          {registryNodes.length > 0 && <div style={sectionDividerStyle} />}
          <div style={sectionLabelStyle}>自定义节点</div>
          {customNodes.map((cn) => (
            <button
              key={cn.key}
              type="button"
              style={{
                ...itemOnCanvasStyle,
                background: hoveredKey === cn.key ? '#f0fdfa' : 'none',
              }}
              onMouseEnter={() => setHoveredKey(cn.key)}
              onMouseLeave={() => setHoveredKey(null)}
              onClick={() => onNodeClick?.(cn.key)}
            >
              <span style={dotStyle('#9ca3af')} />
              <span style={labelStyle}>{cn.label}</span>
              <span style={keyStyle}>{cn.key}</span>
            </button>
          ))}
        </>
      )}
    </div>
  );
}
