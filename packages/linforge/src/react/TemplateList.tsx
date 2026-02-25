// TemplateList — 紧凑卡片列表（侧栏 280px 适配，纯内联样式）

import { useCallback } from 'react';
import type { GraphTemplate } from '../core/types';

export interface TemplateListProps {
  /** Available template list */
  templates: GraphTemplate[];
  /** Whether the canvas is empty (shows guide prompt) */
  isCanvasEmpty?: boolean;
  /** Template selection callback */
  onSelect: (templateId: string) => void;
}

/** Category icon — reuses TemplateGallery logic */
function CategoryIcon({ category }: { category?: string }) {
  const color = CATEGORY_COLORS[category || 'default'] || '#6b7280';
  const paths: Record<string, string> = {
    agent: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    pipeline: 'M5 12h14M12 5l7 7-7 7',
    pattern: 'M4 4h6v6H4zM14 4h6v6h-6zM9 14h6v6H9z',
    default: 'M12 2v20M2 12h20',
  };
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[category || 'default'] || paths.default} />
    </svg>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  agent: '#0d9488',
  pipeline: '#2563eb',
  pattern: '#7c3aed',
  default: '#6b7280',
};

// ---- 内联样式 ----

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const guideStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 10px',
  borderRadius: 8,
  background: '#f0fdfa',
  border: '1px solid #ccfbf1',
  fontSize: 12,
  color: '#0d9488',
  marginBottom: 4,
};

const guideBulbStyle: React.CSSProperties = {
  flexShrink: 0,
  width: 14,
  height: 14,
};

const cardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '7px 10px',
  borderRadius: 8,
  border: '1px solid #e2e8e7',
  background: '#fff',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  width: '100%',
  textAlign: 'left',
};

const cardHoverStyle: React.CSSProperties = {
  ...cardStyle,
  borderColor: '#0d9488',
  background: '#f0fdfa',
  boxShadow: '0 1px 6px rgba(13,148,136,0.1)',
};

const cardDisabledStyle: React.CSSProperties = {
  ...cardStyle,
  opacity: 0.55,
  cursor: 'default',
};

const phase2BadgeStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 500,
  padding: '1px 5px',
  borderRadius: 3,
  background: '#f3f4f6',
  color: '#9ca3af',
  whiteSpace: 'nowrap',
};

const iconWrapStyle: React.CSSProperties = {
  flexShrink: 0,
};

const infoStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const nameRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  justifyContent: 'space-between',
};

const nameStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: '#0f1d1b',
  lineHeight: 1.3,
};

const badgeStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 500,
  padding: '1px 4px',
  borderRadius: 3,
  background: '#f1f5f4',
  color: '#8da5a2',
  whiteSpace: 'nowrap',
};

const descStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#8da5a2',
  margin: '2px 0 0',
  lineHeight: 1.4,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

export function TemplateList({
  templates,
  isCanvasEmpty,
  onSelect,
}: TemplateListProps) {
  const handleSelect = useCallback(
    (id: string) => {
      onSelect(id);
    },
    [onSelect],
  );

  if (templates.length === 0) {
    return (
      <div style={{ fontSize: 12, color: '#8da5a2', padding: '8px 0' }}>
        暂无可用模板
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* 空画布引导提示 */}
      {isCanvasEmpty && (
        <div style={guideStyle}>
          <svg
            style={guideBulbStyle}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
            <path d="M9 18h6" />
            <path d="M10 22h4" />
          </svg>
          <span>选择一个模板快速开始</span>
        </div>
      )}

      {templates.map((t) => {
        const isDisabled = !!t.disabled;
        const style = isDisabled ? cardDisabledStyle : cardStyle;

        return (
          <button
            key={t.id}
            type="button"
            style={style}
            disabled={isDisabled}
            onMouseEnter={(e) => {
              if (isDisabled) return;
              e.currentTarget.style.borderColor = '#0d9488';
              e.currentTarget.style.background = '#f0fdfa';
              e.currentTarget.style.boxShadow =
                '0 1px 6px rgba(13,148,136,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e2e8e7';
              e.currentTarget.style.background = '#fff';
              e.currentTarget.style.boxShadow = 'none';
            }}
            onClick={() => !isDisabled && handleSelect(t.id)}
          >
            <div style={iconWrapStyle}>
              <CategoryIcon category={t.category} />
            </div>
            <div style={infoStyle}>
              <div style={nameRowStyle}>
                <span style={nameStyle}>{t.name}</span>
                {isDisabled ? (
                  <span style={phase2BadgeStyle}>Phase 2</span>
                ) : (
                  <span style={badgeStyle}>
                    {t.nodes.length}节点 · {t.edges.length}边
                  </span>
                )}
              </div>
              {t.description && (
                <p style={descStyle} title={t.description}>
                  {t.description}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
