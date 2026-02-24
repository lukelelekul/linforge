import React, { useState, useCallback, useMemo } from 'react';
import { BUILTIN_ICONS, getIconById, IconPlus } from './icons';

export interface CreateGraphDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: {
    name: string;
    slug: string;
    icon?: string;
  }) => Promise<void>;
}

/** Auto-generate slug from name (lowercase + hyphens) */
function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/[\u4e00-\u9fff]+/g, '')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

const SLUG_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

export function CreateGraphDialog({
  open,
  onClose,
  onCreate,
}: CreateGraphDialogProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [icon, setIcon] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const slugValue = slugManual ? slug : nameToSlug(name);
  const slugValid = SLUG_RE.test(slugValue);
  const canSubmit = name.trim() && slugValue && slugValid && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      await onCreate({ name: name.trim(), slug: slugValue, icon });
      // 重置
      setName('');
      setSlug('');
      setSlugManual(false);
      setIcon(undefined);
      onClose();
    } catch (err: any) {
      setError(err.message || '创建失败');
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, name, slugValue, icon, onCreate, onClose]);

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
        '新建 Agent',
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
        placeholder: '例：ContentRadar Agent',
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
      // Slug
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
        'Slug（URL 标识）',
      ),
      React.createElement('input', {
        value: slugValue,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
          setSlugManual(true);
          setSlug(e.target.value);
        },
        placeholder: 'content-radar',
        style: {
          width: '100%',
          padding: '8px 12px',
          borderRadius: 10,
          border: `1px solid ${slugValue && !slugValid ? '#ef4444' : '#e2e8e7'}`,
          fontSize: 13,
          fontFamily: 'monospace',
          outline: 'none',
          boxSizing: 'border-box',
          marginBottom: slugValue && !slugValid ? 4 : 14,
        },
      }),
      slugValue && !slugValid
        ? React.createElement(
            'div',
            {
              style: {
                fontSize: 11,
                color: '#ef4444',
                marginBottom: 14,
              },
            },
            '仅允许小写字母、数字、连字符，首尾不能为连字符',
          )
        : null,
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
        '图标（可选）',
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
              boxShadow: canSubmit ? '0 2px 8px rgba(13,148,136,0.25)' : 'none',
            },
          },
          submitting ? '创建中...' : '创建',
        ),
      ),
    ),
  );
}
