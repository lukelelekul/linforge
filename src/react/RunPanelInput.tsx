// RunPanelInput — 指令输入区

import { useState, useCallback } from 'react';

export interface RunPanelInputProps {
  onTrigger: (instruction: string) => Promise<string>;
  disabled?: boolean;
}

/** Gradient button style */
const btnStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 0',
  borderRadius: 10,
  border: 'none',
  background: 'linear-gradient(135deg, #14b8a6, #0d9488)',
  color: '#fff',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(13, 148, 136, 0.25)',
  transition: 'all 0.15s',
};

const btnDisabledStyle: React.CSSProperties = {
  ...btnStyle,
  opacity: 0.6,
  cursor: 'not-allowed',
};

export function RunPanelInput({ onTrigger, disabled }: RunPanelInputProps) {
  const [instruction, setInstruction] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    const text = instruction.trim();
    if (!text || submitting || disabled) return;
    setSubmitting(true);
    try {
      await onTrigger(text);
      setInstruction('');
    } finally {
      setSubmitting(false);
    }
  }, [instruction, submitting, disabled, onTrigger]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const isDisabled = disabled || submitting || !instruction.trim();

  return (
    <div style={{ padding: '16px 16px 12px' }}>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: '#1f2937',
          marginBottom: 10,
        }}
      >
        运行 Agent
      </div>
      <textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="输入运行指令..."
        rows={3}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 10,
          border: '1px solid #e2e8e7',
          background: '#f8fafa',
          fontSize: 13,
          color: '#1f2937',
          resize: 'none',
          outline: 'none',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
        }}
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isDisabled}
        style={isDisabled ? btnDisabledStyle : btnStyle}
      >
        {submitting ? '启动中...' : '启动运行'}
      </button>
    </div>
  );
}
