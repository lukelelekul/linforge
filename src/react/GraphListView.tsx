import React, { useState, useCallback } from 'react';
import {
  useLinforgeGraphList,
  type GraphListItem,
} from './useLinforgeGraphList';
import { CreateGraphDialog } from './CreateGraphDialog';
import { EditGraphDialog } from './EditGraphDialog';
import { getIconById, IconPlus, IconPencil, IconSquare } from './icons';

export interface GraphListViewProps {
  /** API prefix (e.g. '/api/linforge') */
  apiBase: string;
  /** Custom header area */
  header?: React.ReactNode;
  /** Graph selection callback */
  onSelectGraph: (slug: string) => void;
}

export function GraphListView({
  apiBase,
  header,
  onSelectGraph,
}: GraphListViewProps) {
  const { graphs, loading, error, createGraph, updateGraph } =
    useLinforgeGraphList(apiBase);

  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<GraphListItem | null>(null);

  const handleCreate = useCallback(
    async (input: { name: string; slug: string; icon?: string }) => {
      const created = await createGraph(input);
      onSelectGraph(created.slug);
    },
    [createGraph, onSelectGraph],
  );

  const handleEdit = useCallback(
    async (input: { name?: string; icon?: string }) => {
      if (!editItem) return;
      await updateGraph(editItem.slug, input);
    },
    [editItem, updateGraph],
  );

  return React.createElement(
    'div',
    {
      style: {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#f8fafa',
      },
    },
    // 顶栏
    React.createElement(
      'div',
      {
        style: {
          padding: '20px 28px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #e2e8e7',
          background: '#fff',
        },
      },
      header ||
        React.createElement(
          'div',
          null,
          React.createElement(
            'h1',
            {
              style: {
                fontSize: 20,
                fontWeight: 600,
                color: '#0f1d1b',
                margin: 0,
              },
            },
            'Linforge',
          ),
          React.createElement(
            'p',
            {
              style: {
                fontSize: 13,
                color: '#8da5a2',
                margin: '4px 0 0',
              },
            },
            'Agent 工作台',
          ),
        ),
      React.createElement(
        'button',
        {
          onClick: () => setCreateOpen(true),
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            borderRadius: 10,
            border: 'none',
            background: 'linear-gradient(135deg, #14b8a6, #0d9488)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(13,148,136,0.25)',
          },
        },
        IconPlus({ size: 14 }),
        '新建 Agent',
      ),
    ),
    // 内容区
    React.createElement(
      'div',
      {
        style: {
          flex: 1,
          overflow: 'auto',
          padding: 28,
        },
      },
      loading
        ? React.createElement(
            'div',
            {
              style: {
                textAlign: 'center',
                padding: 60,
                color: '#8da5a2',
                fontSize: 13,
              },
            },
            '加载中...',
          )
        : error
          ? React.createElement(
              'div',
              {
                style: {
                  textAlign: 'center',
                  padding: 60,
                  color: '#dc2626',
                  fontSize: 13,
                },
              },
              `加载失败：${error}`,
            )
          : graphs.length === 0
            ? // 空状态
              React.createElement(
                'div',
                {
                  style: {
                    textAlign: 'center',
                    padding: 80,
                  },
                },
                React.createElement(
                  'div',
                  {
                    style: {
                      width: 56,
                      height: 56,
                      borderRadius: 14,
                      background: '#f0fdfa',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px',
                    },
                  },
                  IconSquare({ size: 24, color: '#0d9488' }),
                ),
                React.createElement(
                  'div',
                  {
                    style: {
                      fontSize: 15,
                      fontWeight: 500,
                      color: '#0f1d1b',
                      marginBottom: 6,
                    },
                  },
                  '暂无 Agent',
                ),
                React.createElement(
                  'div',
                  {
                    style: { fontSize: 13, color: '#8da5a2' },
                  },
                  '点击「新建 Agent」开始创建你的第一个 Agent',
                ),
              )
            : // 卡片网格
              React.createElement(
                'div',
                {
                  style: {
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 16,
                  },
                },
                ...graphs.map((g) => {
                  const IconComp = g.icon ? getIconById(g.icon) : null;
                  return React.createElement(
                    'div',
                    {
                      key: g.slug,
                      onClick: () => onSelectGraph(g.slug),
                      style: {
                        background: '#fff',
                        borderRadius: 14,
                        border: '1px solid rgba(0,0,0,0.05)',
                        padding: 20,
                        cursor: 'pointer',
                        boxShadow:
                          '0 1px 3px rgba(0,0,0,0.03), 0 1px 2px rgba(0,0,0,0.02)',
                        transition: 'all 0.2s ease',
                        position: 'relative',
                      },
                      onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => {
                        e.currentTarget.style.boxShadow =
                          '0 4px 16px rgba(0,0,0,0.05), 0 2px 6px rgba(0,0,0,0.03)';
                        e.currentTarget.style.borderColor = 'rgba(0,0,0,0.07)';
                      },
                      onMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => {
                        e.currentTarget.style.boxShadow =
                          '0 1px 3px rgba(0,0,0,0.03), 0 1px 2px rgba(0,0,0,0.02)';
                        e.currentTarget.style.borderColor = 'rgba(0,0,0,0.05)';
                      },
                    },
                    // 编辑按钮（右上角）
                    React.createElement(
                      'button',
                      {
                        onClick: (e: React.MouseEvent) => {
                          e.stopPropagation();
                          setEditItem(g);
                        },
                        style: {
                          position: 'absolute',
                          top: 12,
                          right: 12,
                          width: 28,
                          height: 28,
                          borderRadius: 7,
                          border: '1px solid #e2e8e7',
                          background: '#fff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#8da5a2',
                          opacity: 0.6,
                          transition: 'opacity 0.15s',
                        },
                        onMouseEnter: (
                          e: React.MouseEvent<HTMLButtonElement>,
                        ) => {
                          e.currentTarget.style.opacity = '1';
                        },
                        onMouseLeave: (
                          e: React.MouseEvent<HTMLButtonElement>,
                        ) => {
                          e.currentTarget.style.opacity = '0.6';
                        },
                      },
                      IconPencil({ size: 12 }),
                    ),
                    // 图标 + 名称
                    React.createElement(
                      'div',
                      {
                        style: {
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          marginBottom: 10,
                        },
                      },
                      React.createElement(
                        'div',
                        {
                          style: {
                            width: 40,
                            height: 40,
                            borderRadius: 10,
                            background: '#f0fdfa',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          },
                        },
                        IconComp
                          ? IconComp({ size: 18, color: '#0d9488' })
                          : IconSquare({ size: 18, color: '#0d9488' }),
                      ),
                      React.createElement(
                        'div',
                        null,
                        React.createElement(
                          'div',
                          {
                            style: {
                              fontSize: 14,
                              fontWeight: 600,
                              color: '#0f1d1b',
                            },
                          },
                          g.name,
                        ),
                        React.createElement(
                          'div',
                          {
                            style: {
                              fontSize: 11,
                              color: '#8da5a2',
                              fontFamily: 'monospace',
                            },
                          },
                          g.slug,
                        ),
                      ),
                    ),
                    // 统计
                    React.createElement(
                      'div',
                      {
                        style: {
                          display: 'flex',
                          gap: 12,
                          fontSize: 11,
                          color: '#8da5a2',
                        },
                      },
                      React.createElement('span', null, `${g.nodeCount} 节点`),
                      React.createElement('span', null, `${g.edgeCount} 边`),
                    ),
                  );
                }),
              ),
    ),
    // 弹窗
    React.createElement(CreateGraphDialog, {
      open: createOpen,
      onClose: () => setCreateOpen(false),
      onCreate: handleCreate,
    }),
    editItem
      ? React.createElement(EditGraphDialog, {
          open: true,
          onClose: () => setEditItem(null),
          onSave: handleEdit,
          initialName: editItem.name,
          initialIcon: editItem.icon,
          slug: editItem.slug,
        })
      : null,
  );
}
