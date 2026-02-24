// LinforgeWorkbench — 一体化工作台壳组件

import React, { createElement } from 'react';
import { useInternalRouter } from './useInternalRouter';
import { GraphListView } from './GraphListView';
import { GraphStudioView } from './GraphStudioView';

export interface LinforgeWorkbenchProps {
  /** API prefix (e.g. '/api/linforge') */
  apiBase: string;
  /** Route prefix (e.g. '/linforge'), used for internal pushState routing */
  basePath: string;
  /** Custom list page header area (defaults to "Linforge") */
  header?: React.ReactNode;
  /** Prompt placeholder docs per node */
  promptPlaceholders?: Record<string, string[]>;
  /** Binding steps for unbound (skeleton) nodes */
  skeletonBindingSteps?: string[];
}

export function LinforgeWorkbench({
  apiBase,
  basePath,
  header,
  promptPlaceholders,
  skeletonBindingSteps,
}: LinforgeWorkbenchProps) {
  const { currentSlug, navigateTo, navigateToList } =
    useInternalRouter(basePath);

  const child = currentSlug
    ? createElement(GraphStudioView, {
        slug: currentSlug,
        apiBase,
        onBack: navigateToList,
        promptPlaceholders,
        skeletonBindingSteps,
      })
    : createElement(GraphListView, {
        apiBase,
        header,
        onSelectGraph: navigateTo,
      });

  return createElement(
    'div',
    { style: { height: '100%', minHeight: '100vh' } },
    child,
  );
}
