// Linforge built-in icon set + color presets
// 8 commonly used Agent icons (inline SVG, no host icon library dependency)
// 7 preset colors

import React, { createElement } from 'react';

// ---- SVG 图标（16x16，stroke-based） ----

export type IconComponent = (props?: {
  size?: number;
  color?: string;
}) => React.ReactNode;

function svgIcon(paths: string[], opts?: { fill?: boolean }): IconComponent {
  return (props) => {
    const size = props?.size ?? 16;
    const color = props?.color ?? 'currentColor';
    return createElement(
      'svg',
      {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: color,
        strokeWidth: 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        style: { flexShrink: 0 },
      },
      ...paths.map((d, i) =>
        createElement(opts?.fill ? 'path' : 'path', { key: i, d }),
      ),
    );
  };
}

/** Edit/Plan — pencil */
export const IconEdit = svgIcon([
  'M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z',
  'M15 5l4 4',
]);

/** Observe/Analyze — eye */
export const IconEye = svgIcon([
  'M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0',
  'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
]);

/** Lightning/Execute — zap */
export const IconZap = svgIcon(['M13 2 3 14h9l-1 8 10-12h-9l1-8Z']);

/** Lightbulb/Generate — lightbulb */
export const IconLightbulb = svgIcon([
  'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5',
  'M9 18h6',
  'M10 22h4',
]);

/** Link/Connect — link */
export const IconLink = svgIcon([
  'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71',
  'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
]);

/** Emoji/Interact — smile */
export const IconSmile = svgIcon([
  'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z',
  'M8 14s1.5 2 4 2 4-2 4-2',
  'M9 9h.01',
  'M15 9h.01',
]);

/** Square/Generic — square (rounded) */
export const IconSquare = svgIcon([
  'M3 8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8Z',
]);

/** Copy/Save — copy */
export const IconCopy = svgIcon([
  'M16 3H4a1 1 0 0 0-1 1v12',
  'M8 7h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z',
]);

/** Right arrow — chevronRight */
export const IconChevronRight = svgIcon(['M9 18l6-6-6-6']);

/** Close — x */
export const IconX = svgIcon(['M18 6 6 18', 'M6 6l12 12']);

/** Plus — plus */
export const IconPlus = svgIcon(['M12 5v14', 'M5 12h14']);

/** Left arrow — arrowLeft */
export const IconArrowLeft = svgIcon(['M19 12H5', 'M12 19l-7-7 7-7']);

/** Pencil/Edit — pencil (smaller) */
export const IconPencil = svgIcon([
  'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z',
]);

// ---- Icon registry ----

export interface LinforgeIcon {
  id: string;
  label: string;
  component: IconComponent;
}

export const BUILTIN_ICONS: LinforgeIcon[] = [
  { id: 'edit', label: '编辑/规划', component: IconEdit },
  { id: 'eye', label: '观察/分析', component: IconEye },
  { id: 'zap', label: '闪电/执行', component: IconZap },
  { id: 'lightbulb', label: '灯泡/生成', component: IconLightbulb },
  { id: 'link', label: '链接/关联', component: IconLink },
  { id: 'smile', label: '表情/交互', component: IconSmile },
  { id: 'square', label: '方块/通用', component: IconSquare },
  { id: 'copy', label: '复制/保存', component: IconCopy },
];

/** Find icon component by id */
export function getIconById(id: string): IconComponent | null {
  return BUILTIN_ICONS.find((i) => i.id === id)?.component ?? null;
}

// ---- Color presets ----

export interface LinforgeColor {
  id: string;
  label: string;
  value: string;
}

export const BUILTIN_COLORS: LinforgeColor[] = [
  { id: 'teal', label: '默认/主要', value: '#0d9488' },
  { id: 'blue', label: '工具/执行', value: '#2563eb' },
  { id: 'amber', label: '条件/检查', value: '#d97706' },
  { id: 'purple', label: '分析/AI', value: '#7c3aed' },
  { id: 'pink', label: '人工/审核', value: '#db2777' },
  { id: 'green', label: '保存/完成', value: '#059669' },
  { id: 'gray', label: '通用/辅助', value: '#6b7280' },
];
