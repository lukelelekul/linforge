// ContextMenu — 画布右键弹出菜单（节点池入口）

import { useEffect, useRef } from 'react';
import type { RegistryNode } from './EdgeConfigPopover';

export interface ContextMenuProps {
  /** Mouse screen X coordinate */
  x: number;
  /** Mouse screen Y coordinate */
  y: number;
  /** Registered node list */
  registryNodes: RegistryNode[];
  /** List of node keys already on the canvas */
  existingKeys: string[];
  /** List of skeleton (unbound code implementation) node keys */
  skeletonKeys?: string[];
  /** Click registered node (create directly, no dialog) */
  onAddRegisteredNode: (nodeKey: string, label: string) => void;
  /** Click "Custom Node" (opens dialog for key + label input) */
  onAddCustomNode: () => void;
  /** Close menu */
  onClose: () => void;
}

// ---- 内联样式 ----

const menuStyle: React.CSSProperties = {
  position: 'fixed',
  zIndex: 50,
  minWidth: 180,
  maxHeight: 320,
  overflowY: 'auto',
  borderRadius: 10,
  border: '1px solid #e2e8e7',
  background: '#fff',
  padding: '4px 0',
  boxShadow: '0 4px 16px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)',
};

const sectionLabelStyle: React.CSSProperties = {
  padding: '6px 12px 4px',
  fontSize: 10,
  fontWeight: 600,
  color: '#8da5a2',
  letterSpacing: '0.05em',
  textTransform: 'uppercase' as const,
};

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '7px 12px',
  border: 'none',
  background: 'none',
  textAlign: 'left',
  fontSize: 13,
  color: '#0f1d1b',
  cursor: 'pointer',
  transition: 'background 0.1s',
};

const itemDisabledStyle: React.CSSProperties = {
  ...itemStyle,
  color: '#c5d5d3',
  cursor: 'default',
};

const itemKeyStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#8da5a2',
  marginLeft: 'auto',
  fontFamily: 'monospace',
};

const itemKeyDisabledStyle: React.CSSProperties = {
  ...itemKeyStyle,
  color: '#d5e0de',
};

const separatorStyle: React.CSSProperties = {
  height: 1,
  background: '#e2e8e7',
  margin: '4px 0',
};

const customItemStyle: React.CSSProperties = {
  ...itemStyle,
  color: '#4b6563',
};

const plusIconStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 300,
  color: '#8da5a2',
  width: 16,
  textAlign: 'center',
};

const dotStyle = (
  status: 'bound' | 'skeleton' | 'absent',
): React.CSSProperties => ({
  width: 6,
  height: 6,
  borderRadius: '50%',
  background:
    status === 'bound'
      ? '#0d9488'
      : status === 'skeleton'
        ? '#9ca3af'
        : '#d5e0de',
  flexShrink: 0,
});

export function ContextMenu({
  x,
  y,
  registryNodes,
  existingKeys,
  skeletonKeys,
  onAddRegisteredNode,
  onAddCustomNode,
  onClose,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const existingSet = new Set(existingKeys);
  const skeletonSet = new Set(skeletonKeys || []);
  const hasRegistryNodes = registryNodes.length > 0;

  return (
    <div ref={ref} style={{ ...menuStyle, left: x, top: y }}>
      {/* 已注册节点列表 */}
      {hasRegistryNodes && (
        <>
          <div style={sectionLabelStyle}>已注册节点</div>
          {registryNodes.map((rn) => {
            const isOnCanvas = existingSet.has(rn.key);
            const isSkeleton = skeletonSet.has(rn.key);
            const status = isOnCanvas
              ? isSkeleton
                ? 'skeleton'
                : 'bound'
              : 'absent';
            return (
              <button
                key={rn.key}
                type="button"
                style={isOnCanvas ? itemDisabledStyle : itemStyle}
                disabled={isOnCanvas}
                onClick={() => {
                  if (!isOnCanvas) {
                    onAddRegisteredNode(rn.key, rn.label || rn.key);
                  }
                }}
                onMouseEnter={(e) => {
                  if (!isOnCanvas) {
                    e.currentTarget.style.background = '#f0fdfa';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'none';
                }}
              >
                <span style={dotStyle(status)} />
                <span>{rn.label || rn.key}</span>
                <span style={isOnCanvas ? itemKeyDisabledStyle : itemKeyStyle}>
                  {rn.key}
                </span>
              </button>
            );
          })}
          <div style={separatorStyle} />
        </>
      )}

      {/* 自定义节点入口 */}
      <button
        type="button"
        style={customItemStyle}
        onClick={onAddCustomNode}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#f0fdfa';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'none';
        }}
      >
        <span style={plusIconStyle}>+</span>
        <span>自定义节点</span>
      </button>
    </div>
  );
}
