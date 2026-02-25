// EdgeConfigPopover — 边配置弹出框（纯内联样式，不依赖宿主 Tailwind）

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Edge } from '@xyflow/react';

export interface RegistryNode {
  key: string;
  label?: string;
  routeKeys: string[];
  bound?: boolean;
}

export interface EdgeConfigPopoverProps {
  /** Current edge being edited */
  edge: Edge;
  /** Popover position (screen coordinates) */
  position: { x: number; y: number };
  /** Registered route keys of the source node */
  sourceRouteKeys: string[];
  /** Route keys already used by sibling conditional edges from the same source (excludes current edge) */
  usedRouteKeys?: Set<string>;
  /** Save callback */
  onSave: (
    edgeId: string,
    updates: { label?: string; routeMap?: Record<string, string> },
  ) => void;
  /** Close callback */
  onClose: () => void;
}

/** Container style */
const containerStyle: React.CSSProperties = {
  position: 'fixed',
  zIndex: 1000,
  background: '#fff',
  borderRadius: '12px',
  border: '1px solid #e2e8e7',
  boxShadow: '0 4px 16px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)',
  padding: '16px',
  minWidth: '280px',
  maxWidth: '360px',
  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  fontSize: '13px',
  color: '#0f1d1b',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 600,
  color: '#4b6563',
  marginBottom: '4px',
  letterSpacing: '0.05em',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '8px',
  border: '1px solid #e2e8e7',
  background: '#f8fafa',
  fontSize: '13px',
  color: '#0f1d1b',
  outline: 'none',
  boxSizing: 'border-box',
};

const toggleContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginTop: '12px',
  marginBottom: '4px',
};

const routeKeyRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '6px 0',
  fontSize: '12px',
  borderBottom: '1px solid #f1f5f4',
};

const routeKeyLabelStyle: React.CSSProperties = {
  fontFamily: 'ui-monospace, monospace',
  fontSize: '12px',
  color: '#0f766e',
  background: '#f0fdfa',
  padding: '2px 6px',
  borderRadius: '4px',
};

const targetBadgeStyle: React.CSSProperties = {
  fontSize: '11px',
  color: '#8da5a2',
};

const btnPrimaryStyle: React.CSSProperties = {
  padding: '6px 16px',
  borderRadius: '8px',
  border: 'none',
  background: 'linear-gradient(135deg, #14b8a6, #0d9488)',
  color: '#fff',
  fontSize: '12px',
  fontWeight: 500,
  cursor: 'pointer',
};

const btnSecondaryStyle: React.CSSProperties = {
  padding: '6px 16px',
  borderRadius: '8px',
  border: '1px solid #e2e8e7',
  background: '#fff',
  color: '#4b6563',
  fontSize: '12px',
  fontWeight: 500,
  cursor: 'pointer',
};

export function EdgeConfigPopover({
  edge,
  position,
  sourceRouteKeys,
  usedRouteKeys,
  onSave,
  onClose,
}: EdgeConfigPopoverProps) {
  const edgeData = edge.data as Record<string, unknown> | undefined;
  // 只保留 value === edge.target 的条目，过滤历史脏数据
  const existingRouteMap = (() => {
    const raw = (edgeData?.routeMap as Record<string, string>) || {};
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v === edge.target) cleaned[k] = v;
    }
    return cleaned;
  })();
  const [label, setLabel] = useState((edge.label as string) || '');
  const [isConditional, setIsConditional] = useState(
    Object.keys(existingRouteMap).length > 0,
  );
  const [routeMap, setRouteMap] = useState<Record<string, string>>(
    () => existingRouteMap,
  );
  const popoverRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    // 延迟绑定，避免触发当前的 click 事件
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [onClose]);

  const handleSave = useCallback(() => {
    const updates: { label?: string; routeMap?: Record<string, string> } = {};
    updates.label = label || undefined;
    if (isConditional && sourceRouteKeys.length > 0) {
      // 只保留 value === edge.target 的有效映射
      const validMap: Record<string, string> = {};
      for (const key of sourceRouteKeys) {
        if (routeMap[key] === edge.target) {
          validMap[key] = routeMap[key];
        }
      }
      // 至少有一个映射时才设为条件边
      updates.routeMap =
        Object.keys(validMap).length > 0 ? validMap : undefined;
    } else {
      updates.routeMap = undefined;
    }
    onSave(edge.id, updates);
  }, [edge.id, label, isConditional, sourceRouteKeys, routeMap, onSave]);

  // 弹出位置：优先显示在点击上方，空间不足时翻转到下方
  const [flipped, setFlipped] = useState(false);
  useEffect(() => {
    if (!popoverRef.current) return;
    const rect = popoverRef.current.getBoundingClientRect();
    // 如果弹出框顶部超出视口，翻转到点击下方
    setFlipped(rect.top < 8);
  }, [position]);

  const popoverStyle: React.CSSProperties = {
    ...containerStyle,
    left: position.x,
    top: position.y,
    transform: flipped
      ? 'translate(-50%, 12px)'
      : 'translate(-50%, -100%) translateY(-12px)',
  };

  return (
    <div ref={popoverRef} style={popoverStyle}>
      {/* 标签输入 */}
      <div>
        <label style={labelStyle}>边标签</label>
        <input
          style={inputStyle}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="输入边标签..."
          onFocus={(e) => {
            (e.target as HTMLInputElement).style.borderColor = '#14b8a6';
            (e.target as HTMLInputElement).style.boxShadow =
              '0 0 0 2px rgba(153,246,228,0.4)';
          }}
          onBlur={(e) => {
            (e.target as HTMLInputElement).style.borderColor = '#e2e8e7';
            (e.target as HTMLInputElement).style.boxShadow = 'none';
          }}
        />
      </div>

      {/* 条件边 Toggle */}
      <div style={toggleContainerStyle}>
        <span style={{ fontSize: '12px', fontWeight: 500 }}>条件边</span>
        <button
          type="button"
          onClick={() => setIsConditional((prev) => !prev)}
          style={{
            width: '40px',
            height: '22px',
            borderRadius: '11px',
            border: 'none',
            background: isConditional ? '#14b8a6' : '#e2e8e7',
            cursor: 'pointer',
            position: 'relative',
            transition: 'background 0.15s',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: '2px',
              left: isConditional ? '20px' : '2px',
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              transition: 'left 0.15s',
            }}
          />
        </button>
      </div>

      {/* Route Keys 映射列表 */}
      {isConditional && (
        <div style={{ marginTop: '8px' }}>
          {sourceRouteKeys.length > 0 ? (
            sourceRouteKeys
              .filter((rk) => !usedRouteKeys?.has(rk) || routeMap[rk])
              .map((rk) => {
                const isActive = routeMap[rk] === edge.target;
                return (
                  <div
                    key={rk}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setRouteMap((prev) => {
                        const updated = { ...prev };
                        if (isActive) {
                          delete updated[rk];
                        } else {
                          updated[rk] = edge.target;
                        }
                        return updated;
                      });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setRouteMap((prev) => {
                          const updated = { ...prev };
                          if (isActive) {
                            delete updated[rk];
                          } else {
                            updated[rk] = edge.target;
                          }
                          return updated;
                        });
                      }
                    }}
                    style={{
                      ...routeKeyRowStyle,
                      cursor: 'pointer',
                      ...(isActive
                        ? {
                            background: '#f0fdfa',
                            borderRadius: '6px',
                            padding: '6px 8px',
                            borderBottom: '1px solid #ccfbf1',
                          }
                        : {}),
                    }}
                  >
                    <span
                      style={{
                        ...routeKeyLabelStyle,
                        ...(isActive
                          ? { fontWeight: 600 }
                          : { color: '#8da5a2', background: '#f8fafa' }),
                      }}
                    >
                      {rk}
                      {isActive && (
                        <span
                          style={{
                            marginLeft: '6px',
                            fontSize: '10px',
                            color: '#0d9488',
                            fontFamily: 'Inter, system-ui, sans-serif',
                            fontWeight: 500,
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </span>
                    <span
                      style={{
                        ...targetBadgeStyle,
                        ...(isActive
                          ? { color: '#0f766e', fontWeight: 500 }
                          : { color: '#d1d5db', fontStyle: 'italic' }),
                      }}
                    >
                      {isActive ? `→ ${edge.target}` : '点击指定'}
                    </span>
                  </div>
                );
              })
          ) : (
            <div
              style={{ fontSize: '12px', color: '#8da5a2', padding: '8px 0' }}
            >
              源节点未注册 route keys
            </div>
          )}
        </div>
      )}

      {/* 操作按钮 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '8px',
          marginTop: '16px',
        }}
      >
        <button type="button" style={btnSecondaryStyle} onClick={onClose}>
          取消
        </button>
        <button type="button" style={btnPrimaryStyle} onClick={handleSave}>
          保存
        </button>
      </div>
    </div>
  );
}
