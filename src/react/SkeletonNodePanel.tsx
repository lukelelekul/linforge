// SkeletonNodePanel — skeleton 节点引导面板
// 点击未绑定代码的节点时显示，引导用户完成实现
// 纯内联样式，不依赖宿主 Tailwind

import type { GraphNodeDef } from '../core/types';
import { getIconById } from './icons';

export interface SkeletonNodePanelProps {
  /** Node key */
  nodeKey: string;
  /** Node definition (from graphDef.nodes) */
  node: GraphNodeDef;
  /** Close panel */
  onClose: () => void;
  /** Custom binding step descriptions (overrides default steps) */
  bindingSteps?: string[];
}

/** Default binding steps — Linforge defineNode paradigm */
const DEFAULT_STEPS = [
  '使用 defineNode() 创建节点定义',
  '实现 run 函数（业务逻辑）',
  '在启动时调用 registry.register() 注册节点',
];

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
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '16px 20px',
  borderBottom: '1px solid #e2e8e7',
  flexShrink: 0,
};

const headerIconWrapStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  background: '#f3f4f6',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const headerTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: '#0f1d1b',
  lineHeight: 1.3,
};

const headerSubStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#8da5a2',
  marginTop: 1,
};

const closeButtonStyle: React.CSSProperties = {
  marginLeft: 'auto',
  width: 28,
  height: 28,
  borderRadius: 8,
  border: 'none',
  background: 'transparent',
  color: '#8da5a2',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const bodyStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '24px 20px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const guideBoxStyle: React.CSSProperties = {
  width: '100%',
  border: '2px dashed #d1d5db',
  borderRadius: 14,
  padding: '32px 24px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 12,
};

const warningIconStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: '50%',
  background: '#fffbeb',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 4,
};

const guideTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: '#0f1d1b',
};

const guideDescStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#4b6563',
  textAlign: 'center',
  lineHeight: 1.5,
};

const stepsCardStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #e2e8e7',
  borderRadius: 10,
  padding: '14px 16px',
  marginTop: 4,
};

const stepsLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#0f1d1b',
  marginBottom: 10,
};

const stepItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  fontSize: 13,
  color: '#4b6563',
  lineHeight: 1.5,
  marginBottom: 6,
};

const stepNumStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#8da5a2',
  flexShrink: 0,
  width: 16,
};

const stepTextStyle: React.CSSProperties = {
  fontFamily:
    "'SF Mono', 'Menlo', 'Monaco', 'Cascadia Code', 'Consolas', monospace",
  fontSize: 12,
};

const keyAreaStyle: React.CSSProperties = {
  marginTop: 20,
  textAlign: 'center',
};

const keyLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#8da5a2',
  marginBottom: 4,
};

const keyValueStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  fontFamily:
    "'SF Mono', 'Menlo', 'Monaco', 'Cascadia Code', 'Consolas', monospace",
  color: '#0f1d1b',
};

export function SkeletonNodePanel({
  nodeKey,
  node,
  onClose,
  bindingSteps,
}: SkeletonNodePanelProps) {
  const steps = bindingSteps || DEFAULT_STEPS;
  const IconSvg = node.icon ? getIconById(node.icon) : null;

  return (
    <div style={panelStyle}>
      {/* 标题行 */}
      <div style={headerStyle}>
        <div style={headerIconWrapStyle}>
          {IconSvg ? (
            <IconSvg size={18} color="#9ca3af" />
          ) : (
            <DefaultNodeIcon />
          )}
        </div>
        <div>
          <div style={headerTitleStyle}>{node.label || nodeKey}</div>
          <div style={headerSubStyle}>未实现节点</div>
        </div>
        <button
          type="button"
          style={closeButtonStyle}
          onClick={onClose}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#f1f5f4';
            e.currentTarget.style.color = '#0f1d1b';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#8da5a2';
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      {/* 引导区 */}
      <div style={bodyStyle}>
        <div style={guideBoxStyle}>
          {/* 警告图标 */}
          <div style={warningIconStyle}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          </div>

          <div style={guideTitleStyle}>等待代码实现</div>
          <div style={guideDescStyle}>
            该节点已在图模板中定义，但尚未绑定实际执行代码。
          </div>

          {/* 绑定步骤 */}
          <div style={stepsCardStyle}>
            <div style={stepsLabelStyle}>绑定说明</div>
            {steps.map((step, i) => (
              <div key={i} style={stepItemStyle}>
                <span style={stepNumStyle}>{i + 1}.</span>
                <span style={stepTextStyle}>{step}</span>
              </div>
            ))}
          </div>

          {/* 节点 Key */}
          <div style={keyAreaStyle}>
            <div style={keyLabelStyle}>节点 Key</div>
            <div style={keyValueStyle}>{nodeKey}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- 默认节点图标（无 icon 时） ----

function DefaultNodeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#9ca3af"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  );
}
