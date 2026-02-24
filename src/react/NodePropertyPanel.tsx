// NodePropertyPanel — 右侧节点属性编辑面板
// 点击任意节点打开，420px 宽度
// 属性实时 debounce 保存，Prompt 手动保存
// 纯内联样式，不依赖宿主 Tailwind

import { useState, useEffect, useCallback, useRef } from 'react';
import type { GraphNodeDef } from '../core/types';
import { BUILTIN_ICONS, BUILTIN_COLORS, getIconById } from './icons';
import type { LinforgeIcon, LinforgeColor } from './icons';
import { useLinforgePrompt } from './useLinforgePrompt';

// ---- 公开类型 ----

export type NodeChanges = Partial<
  Pick<GraphNodeDef, 'label' | 'description' | 'icon' | 'color'>
>;

export interface NodePropertyPanelProps {
  /** Node key */
  nodeKey: string;
  /** Node definition (from graphDef.nodes) */
  node: GraphNodeDef;
  /** API base path (used for Prompt loading) */
  apiBase: string;
  /** Property change callback (host updates graphDef to trigger save) */
  onNodeChange: (nodeKey: string, changes: NodeChanges) => void;
  /** Close panel */
  onClose: () => void;
  /** Extra icons (host extension) */
  extraIcons?: LinforgeIcon[];
  /** Extra colors (host extension) */
  extraColors?: LinforgeColor[];
  /** Prompt placeholder docs per node: key=nodeKey, value=list of placeholder descriptions */
  promptPlaceholders?: Record<string, string[]>;
}

// ---- 样式常量 ----

const panelStyle: React.CSSProperties = {
  width: 420,
  height: '100%',
  background: '#fff',
  borderLeft: '1px solid #e2e8e7',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  fontSize: 13,
  color: '#0f1d1b',
};

const headerStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid #f1f5f4',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  flexShrink: 0,
};

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: '#8da5a2',
  fontSize: 18,
  lineHeight: 1,
  padding: '0 2px',
};

const bodyStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: '12px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#8da5a2',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  border: '1px solid #e2e8e7',
  borderRadius: 8,
  fontSize: 13,
  color: '#0f1d1b',
  background: '#f8fafa',
  outline: 'none',
  boxSizing: 'border-box' as const,
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 56,
  resize: 'vertical' as const,
  lineHeight: '1.5',
  fontFamily: 'inherit',
};

const iconGridStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
};

const iconCellBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 32,
  borderRadius: 8,
  border: '1.5px solid transparent',
  cursor: 'pointer',
  background: '#f8fafa',
  transition: 'all 0.15s ease',
};

const colorRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
};

const colorCircleBase: React.CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: '50%',
  cursor: 'pointer',
  border: '2.5px solid transparent',
  transition: 'all 0.15s ease',
  boxSizing: 'border-box' as const,
};

const dividerStyle: React.CSSProperties = {
  height: 1,
  background: '#f1f5f4',
  margin: '4px 0',
};

// ---- Prompt 区域样式 ----

const promptTextareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 200,
  padding: '12px 14px',
  border: '1px solid #e2e8e7',
  borderRadius: 10,
  fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
  fontSize: 12,
  lineHeight: '1.6',
  color: '#0f1d1b',
  background: '#f8fafa',
  resize: 'vertical' as const,
  outline: 'none',
  boxSizing: 'border-box' as const,
};

const promptTextareaFocusStyle: React.CSSProperties = {
  ...promptTextareaStyle,
  borderColor: '#2dd4bf',
  boxShadow: '0 0 0 2px rgba(153,246,228,0.3)',
};

const selectStyle: React.CSSProperties = {
  flex: 1,
  padding: '6px 10px',
  border: '1px solid #e2e8e7',
  borderRadius: 8,
  fontSize: 12,
  color: '#0f1d1b',
  background: '#f8fafa',
  outline: 'none',
  cursor: 'pointer',
  boxSizing: 'border-box' as const,
};

const smallInputStyle: React.CSSProperties = {
  width: 80,
  padding: '6px 10px',
  border: '1px solid #e2e8e7',
  borderRadius: 8,
  fontSize: 12,
  color: '#0f1d1b',
  background: '#f8fafa',
  outline: 'none',
  boxSizing: 'border-box' as const,
};

const btnRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  paddingTop: 4,
};

const primaryBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '8px 16px',
  background: 'linear-gradient(135deg, #14b8a6, #0d9488)',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(13,148,136,0.25)',
};

const primaryBtnDisabledStyle: React.CSSProperties = {
  ...primaryBtnStyle,
  opacity: 0.5,
  cursor: 'not-allowed',
};

const secondaryBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '8px 16px',
  background: '#fff',
  color: '#4b6563',
  border: '1px solid #e2e8e7',
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
};

const secondaryBtnDisabledStyle: React.CSSProperties = {
  ...secondaryBtnStyle,
  opacity: 0.5,
  cursor: 'not-allowed',
};

const badgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '1px 6px',
  borderRadius: 4,
  fontSize: 10,
  fontWeight: 500,
  background: '#d1fae5',
  color: '#059669',
  marginLeft: 6,
};

const toastStyle: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 500,
  background: '#d1fae5',
  color: '#059669',
  textAlign: 'center',
};

const errorToastStyle: React.CSSProperties = {
  ...toastStyle,
  background: '#fee2e2',
  color: '#dc2626',
};

// ---- 主组件 ----

export function NodePropertyPanel({
  nodeKey,
  node,
  apiBase,
  onNodeChange,
  onClose,
  extraIcons,
  extraColors,
  promptPlaceholders,
}: NodePropertyPanelProps) {
  const allIcons = extraIcons
    ? [...BUILTIN_ICONS, ...extraIcons]
    : BUILTIN_ICONS;
  const allColors = extraColors
    ? [...BUILTIN_COLORS, ...extraColors]
    : BUILTIN_COLORS;

  // ---- 本地编辑状态（跟随 node prop 同步） ----
  const [localLabel, setLocalLabel] = useState(node.label);
  const [localDesc, setLocalDesc] = useState(node.description ?? '');

  // node 变化时重置本地状态
  useEffect(() => {
    setLocalLabel(node.label);
    setLocalDesc(node.description ?? '');
  }, [nodeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- debounce 保存 ----
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emitChange = useCallback(
    (changes: NodeChanges) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onNodeChange(nodeKey, changes);
      }, 500);
    },
    [nodeKey, onNodeChange],
  );

  // 组件卸载时 flush
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleLabelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setLocalLabel(val);
      emitChange({ label: val });
    },
    [emitChange],
  );

  const handleDescChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setLocalDesc(val);
      emitChange({ description: val });
    },
    [emitChange],
  );

  // 图标/颜色：点击即保存（无 debounce）
  const handleIconChange = useCallback(
    (iconId: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      onNodeChange(nodeKey, { icon: iconId });
    },
    [nodeKey, onNodeChange],
  );

  const handleColorChange = useCallback(
    (colorId: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      onNodeChange(nodeKey, { color: colorId });
    },
    [nodeKey, onNodeChange],
  );

  // 当前选中的图标/颜色
  const currentIcon = node.icon ?? '';
  const currentColor = node.color ?? '';

  // 标题行图标渲染
  const HeaderIcon = getIconById(currentIcon);
  const headerColor =
    allColors.find((c) => c.id === currentColor)?.value ?? '#0d9488';

  const hasPrompt = !!(
    node.hasPrompt ||
    (node.metadata as Record<string, unknown> | undefined)?.hasPrompt
  );

  return (
    <div style={panelStyle}>
      {/* 头部 */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: `${headerColor}14`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {HeaderIcon ? (
              HeaderIcon({ size: 18, color: headerColor })
            ) : (
              <span style={{ fontSize: 16, color: headerColor }}>
                {node.label.charAt(0)}
              </span>
            )}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{node.label}</div>
            <div style={{ fontSize: 11, color: '#8da5a2', marginTop: 1 }}>
              {nodeKey}
            </div>
          </div>
        </div>
        <button style={closeBtnStyle} onClick={onClose} title="关闭">
          ×
        </button>
      </div>

      {/* 主体 */}
      <div style={bodyStyle}>
        {/* 名称 */}
        <div>
          <div style={sectionTitleStyle}>名称</div>
          <input
            style={inputStyle}
            value={localLabel}
            onChange={handleLabelChange}
            placeholder="节点名称"
          />
        </div>

        {/* 描述 */}
        <div>
          <div style={sectionTitleStyle}>描述</div>
          <textarea
            style={textareaStyle}
            value={localDesc}
            onChange={handleDescChange}
            placeholder="节点描述..."
          />
        </div>

        {/* 外观：图标 + 颜色 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={sectionTitleStyle}>图标</div>
            <div style={iconGridStyle}>
              {allIcons.map((icon) => {
                const isActive = currentIcon === icon.id;
                return (
                  <div
                    key={icon.id}
                    style={{
                      ...iconCellBase,
                      borderColor: isActive ? headerColor : 'transparent',
                      background: isActive ? `${headerColor}14` : '#f8fafa',
                    }}
                    onClick={() => handleIconChange(icon.id)}
                    title={icon.label}
                  >
                    {icon.component({
                      size: 15,
                      color: isActive ? headerColor : '#4b6563',
                    })}
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <div style={sectionTitleStyle}>颜色</div>
            <div style={colorRowStyle}>
              {allColors.map((c) => {
                const isActive = currentColor === c.id;
                return (
                  <div
                    key={c.id}
                    style={{
                      ...colorCircleBase,
                      background: c.value,
                      borderColor: isActive ? c.value : 'transparent',
                      boxShadow: isActive
                        ? `0 0 0 1.5px #fff, 0 0 0 3px ${c.value}`
                        : 'none',
                    }}
                    onClick={() => handleColorChange(c.id)}
                    title={c.label}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Prompt 区域（仅 hasPrompt 节点） */}
        {hasPrompt && (
          <>
            <div style={dividerStyle} />
            <PromptSection
              apiBase={apiBase}
              nodeKey={nodeKey}
              nodeLabel={node.label}
              placeholders={promptPlaceholders?.[nodeKey]}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ---- Prompt 子组件（独立挂载以支持条件调用 hook） ----

function PromptSection({
  apiBase,
  nodeKey,
  nodeLabel,
  placeholders,
}: {
  apiBase: string;
  nodeKey: string;
  nodeLabel: string;
  placeholders?: string[];
}) {
  const prompt = useLinforgePrompt({ apiBase, nodeId: nodeKey });
  const { active, versions, loading, createVersion, activateVersion } = prompt;

  const [template, setTemplate] = useState('');
  const [temperature, setTemperature] = useState(0.3);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [textareaFocused, setTextareaFocused] = useState(false);
  const [toast, setToast] = useState<{
    msg: string;
    type: 'ok' | 'err';
  } | null>(null);

  const viewingVersion =
    versions.find((v) => v.id === selectedVersionId) ?? active;

  useEffect(() => {
    if (viewingVersion) {
      setTemplate(viewingVersion.template);
      setTemperature(viewingVersion.temperature);
      setSelectedVersionId(viewingVersion.id);
    } else {
      setTemplate('');
      setTemperature(0.3);
      setSelectedVersionId(null);
    }
  }, [viewingVersion?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isViewingActive = viewingVersion?.isActive ?? false;

  const showToast = useCallback((msg: string, type: 'ok' | 'err') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const handleSave = useCallback(async () => {
    if (!template.trim() || saving) return;
    setSaving(true);
    const result = await createVersion(template, temperature);
    setSaving(false);
    if (result) {
      setSelectedVersionId(result.id);
      showToast(`v${result.version} 已保存`, 'ok');
    } else {
      showToast('保存失败', 'err');
    }
  }, [template, temperature, saving, createVersion, showToast]);

  const handleActivate = useCallback(async () => {
    if (!selectedVersionId || activating) return;
    setActivating(true);
    const ok = await activateVersion(selectedVersionId);
    setActivating(false);
    if (ok) {
      showToast('已激活', 'ok');
    } else {
      showToast('激活失败', 'err');
    }
  }, [selectedVersionId, activating, activateVersion, showToast]);

  if (loading) {
    return (
      <div
        style={{
          textAlign: 'center',
          color: '#8da5a2',
          fontSize: 12,
          padding: '20px 0',
        }}
      >
        加载 Prompt...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={sectionTitleStyle}>Prompt</div>

      {/* 版本选择 */}
      {versions.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select
            style={selectStyle}
            value={selectedVersionId || ''}
            onChange={(e) => setSelectedVersionId(e.target.value || null)}
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.version}
                {v.isActive ? ' (活跃)' : ''}
                {' — '}
                {formatDate(v.createdAt)}
              </option>
            ))}
          </select>
          {isViewingActive && <span style={badgeStyle}>活跃</span>}
        </div>
      )}

      {/* 模板编辑 */}
      <textarea
        style={textareaFocused ? promptTextareaFocusStyle : promptTextareaStyle}
        value={template}
        onChange={(e) => setTemplate(e.target.value)}
        onFocus={() => setTextareaFocused(true)}
        onBlur={() => setTextareaFocused(false)}
        placeholder="输入 Prompt 模板..."
        spellCheck={false}
      />

      {/* 占位符说明 + Temperature 并排 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* 占位符说明 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#8da5a2',
              marginBottom: 4,
            }}
          >
            占位符
          </div>
          {placeholders && placeholders.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {placeholders.map((p) => (
                <code
                  key={p}
                  style={{
                    fontSize: 11,
                    fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
                    color: '#0d9488',
                    background: '#f0fdfa',
                    padding: '1px 6px',
                    borderRadius: 4,
                    border: '1px solid #ccfbf1',
                  }}
                >
                  {`{${p}}`}
                </code>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: '#c5d5d3' }}>无</div>
          )}
        </div>

        {/* Temperature */}
        <div style={{ flexShrink: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#8da5a2',
              marginBottom: 4,
            }}
          >
            Temperature
          </div>
          <input
            type="number"
            style={smallInputStyle}
            value={temperature}
            onChange={(e) =>
              setTemperature(
                Math.max(0, Math.min(2, parseFloat(e.target.value) || 0)),
              )
            }
            step={0.1}
            min={0}
            max={2}
          />
        </div>
      </div>

      {/* 操作按钮 */}
      <div style={btnRowStyle}>
        <button
          style={
            !template.trim() || saving
              ? primaryBtnDisabledStyle
              : primaryBtnStyle
          }
          onClick={handleSave}
          disabled={!template.trim() || saving}
        >
          {saving ? '保存中...' : '保存为新版本'}
        </button>
        <button
          style={
            !selectedVersionId || isViewingActive || activating
              ? secondaryBtnDisabledStyle
              : secondaryBtnStyle
          }
          onClick={handleActivate}
          disabled={!selectedVersionId || isViewingActive || activating}
        >
          {activating ? '激活中...' : '激活此版本'}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div style={toast.type === 'ok' ? toastStyle : errorToastStyle}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ---- 工具函数 ----

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${m}-${day} ${h}:${min}`;
  } catch {
    return dateStr;
  }
}
