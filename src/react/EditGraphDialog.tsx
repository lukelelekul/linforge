import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { BUILTIN_ICONS } from './icons';

export interface EditGraphDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (input: { name?: string; icon?: string }) => Promise<void>;
  initialName: string;
  initialIcon?: string;
  slug: string;
}

export function EditGraphDialog({
  open,
  onClose,
  onSave,
  initialName,
  initialIcon,
  slug,
}: EditGraphDialogProps) {
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState<string | undefined>(initialIcon);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 外部 props 变化时同步
  useEffect(() => {
    setName(initialName);
    setIcon(initialIcon);
  }, [initialName, initialIcon]);

  const canSubmit = name.trim() && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      await onSave({ name: name.trim(), icon });
      onClose();
    } catch (err: any) {
      setError(err.message || '保存失败');
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, name, icon, onSave, onClose]);

  const overlayStyle: React.CSSProperties = useMemo(
    () => ({
      position: 'fixed',
      inset: 0,
      display: open ? 'flex' : 'none',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.4)',
      zIndex: 1000,
    }),
    [open],
  );

  if (!open) return null;

  return React.createElement(
    'div',
    {
      style: overlayStyle,
      onClick: (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
      },
    },
    React.createElement(
      'div',
      {
        style: {
          background: '#fff',
          borderRadius: 14,
          padding: 24,
          width: 420,
          maxWidth: '90vw',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        },
      },
      // 标题
      React.createElement(
        'div',
        {
          style: {
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 20,
            color: '#0f1d1b',
          },
        },
        '编辑 Agent',
      ),
      // 名称
      React.createElement(
        'label',
        {
          style: {
            display: 'block',
            fontSize: 12,
            fontWeight: 500,
            color: '#4b6563',
            marginBottom: 6,
          },
        },
        '名称',
      ),
      React.createElement('input', {
        value: name,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          setName(e.target.value),
        style: {
          width: '100%',
          padding: '8px 12px',
          borderRadius: 10,
          border: '1px solid #e2e8e7',
          fontSize: 13,
          outline: 'none',
          boxSizing: 'border-box',
          marginBottom: 14,
        },
      }),
      // Slug（只读）
      React.createElement(
        'label',
        {
          style: {
            display: 'block',
            fontSize: 12,
            fontWeight: 500,
            color: '#4b6563',
            marginBottom: 6,
          },
        },
        'Slug（不可修改）',
      ),
      React.createElement('div', {
        style: {
          padding: '8px 12px',
          borderRadius: 10,
          border: '1px solid #e2e8e7',
          fontSize: 13,
          fontFamily: 'monospace',
          color: '#8da5a2',
          background: '#f8fafa',
          marginBottom: 14,
        },
        children: slug,
      }),
      // 图标选择
      React.createElement(
        'label',
        {
          style: {
            display: 'block',
            fontSize: 12,
            fontWeight: 500,
            color: '#4b6563',
            marginBottom: 6,
          },
        },
        '图标',
      ),
      React.createElement(
        'div',
        {
          style: {
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            marginBottom: 20,
          },
        },
        ...BUILTIN_ICONS.map((ic) =>
          React.createElement(
            'button',
            {
              key: ic.id,
              onClick: () => setIcon(icon === ic.id ? undefined : ic.id),
              title: ic.label,
              style: {
                width: 36,
                height: 36,
                borderRadius: 8,
                border: `2px solid ${icon === ic.id ? '#0d9488' : '#e2e8e7'}`,
                background: icon === ic.id ? '#f0fdfa' : '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: icon === ic.id ? '#0d9488' : '#8da5a2',
              },
            },
            ic.component({ size: 16 }),
          ),
        ),
      ),
      // 错误
      error
        ? React.createElement(
            'div',
            {
              style: {
                fontSize: 12,
                color: '#dc2626',
                marginBottom: 12,
                padding: '6px 10px',
                background: '#fee2e2',
                borderRadius: 8,
              },
            },
            error,
          )
        : null,
      // 按钮行
      React.createElement(
        'div',
        { style: { display: 'flex', gap: 10, justifyContent: 'flex-end' } },
        React.createElement(
          'button',
          {
            onClick: onClose,
            style: {
              padding: '8px 16px',
              borderRadius: 10,
              border: '1px solid #e2e8e7',
              background: '#fff',
              fontSize: 13,
              color: '#4b6563',
              cursor: 'pointer',
            },
          },
          '取消',
        ),
        React.createElement(
          'button',
          {
            onClick: handleSubmit,
            disabled: !canSubmit,
            style: {
              padding: '8px 16px',
              borderRadius: 10,
              border: 'none',
              background: canSubmit
                ? 'linear-gradient(135deg, #14b8a6, #0d9488)'
                : '#e2e8e7',
              fontSize: 13,
              fontWeight: 500,
              color: canSubmit ? '#fff' : '#8da5a2',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            },
          },
          submitting ? '保存中...' : '保存',
        ),
      ),
    ),
  );
}
