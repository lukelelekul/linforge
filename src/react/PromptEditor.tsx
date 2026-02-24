// PromptEditor — Prompt 查看与编辑面板
// blueprint 模式点击 hasPrompt 节点时展示，420px 宽度
// 纯内联样式，不依赖宿主 Tailwind

import { useState, useEffect, useCallback } from 'react';
import type {
  UseLinforgePromptReturn,
  PromptVersionData,
} from './useLinforgePrompt';

export interface PromptEditorProps {
  /** Prompt data (passed from host via useLinforgePrompt return value) */
  prompt: UseLinforgePromptReturn;
  /** Node key (used for title display) */
  nodeKey: string;
  /** Node label (optional, used for title display) */
  nodeLabel?: string;
  /** Close panel */
  onClose: () => void;
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
  padding: '16px 20px',
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
  padding: '16px 20px',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#8da5a2',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  marginBottom: 8,
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 240,
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

const textareaFocusStyle: React.CSSProperties = {
  ...textareaStyle,
  borderColor: '#2dd4bf',
  boxShadow: '0 0 0 2px rgba(153,246,228,0.3)',
};

const inputRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: '#4b6563',
  minWidth: 80,
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

const emptyStyle: React.CSSProperties = {
  textAlign: 'center',
  color: '#8da5a2',
  fontSize: 12,
  padding: '40px 20px',
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

export function PromptEditor({
  prompt,
  nodeKey,
  nodeLabel,
  onClose,
}: PromptEditorProps) {
  const { active, versions, loading, createVersion, activateVersion } = prompt;

  // 编辑状态
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

  // 查看的版本（选中的或活跃的）
  const viewingVersion =
    versions.find((v) => v.id === selectedVersionId) ?? active;

  // 同步编辑内容到当前查看的版本
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

  // 内容是否有修改
  const hasChanges =
    viewingVersion &&
    (template !== viewingVersion.template ||
      temperature !== viewingVersion.temperature);

  // 当前查看的版本是否已激活
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

  const handleVersionSelect = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedVersionId(e.target.value || null);
    },
    [],
  );

  return (
    <div style={panelStyle}>
      {/* 头部 */}
      <div style={headerStyle}>
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            Prompt
            {isViewingActive && <span style={badgeStyle}>活跃</span>}
          </div>
          <div style={{ fontSize: 12, color: '#8da5a2', marginTop: 3 }}>
            {nodeLabel || nodeKey}
            {viewingVersion && (
              <span style={{ marginLeft: 6, color: '#c5d5d3' }}>
                v{viewingVersion.version}
              </span>
            )}
          </div>
        </div>
        <button style={closeBtnStyle} onClick={onClose} title="关闭">
          ×
        </button>
      </div>

      {/* 主体 */}
      <div style={bodyStyle}>
        {loading ? (
          <div style={emptyStyle}>加载中...</div>
        ) : versions.length === 0 && !active ? (
          <>
            <div style={emptyStyle}>暂无 Prompt 版本，创建第一个吧</div>
            {/* 空状态也显示编辑区 */}
            {renderEditor()}
          </>
        ) : (
          renderEditor()
        )}

        {/* Toast */}
        {toast && (
          <div style={toast.type === 'ok' ? toastStyle : errorToastStyle}>
            {toast.msg}
          </div>
        )}
      </div>
    </div>
  );

  function renderEditor() {
    return (
      <>
        {/* 版本选择 */}
        {versions.length > 0 && (
          <div>
            <div style={sectionTitleStyle}>版本</div>
            <div style={inputRowStyle}>
              <select
                style={selectStyle}
                value={selectedVersionId || ''}
                onChange={handleVersionSelect}
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
            </div>
          </div>
        )}

        {/* 模板编辑 */}
        <div>
          <div style={sectionTitleStyle}>模板</div>
          <textarea
            style={textareaFocused ? textareaFocusStyle : textareaStyle}
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            onFocus={() => setTextareaFocused(true)}
            onBlur={() => setTextareaFocused(false)}
            placeholder="输入 Prompt 模板..."
            spellCheck={false}
          />
        </div>

        {/* Temperature */}
        <div>
          <div style={sectionTitleStyle}>参数</div>
          <div style={inputRowStyle}>
            <span style={labelStyle}>Temperature</span>
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
      </>
    );
  }
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
