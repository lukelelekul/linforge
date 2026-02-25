// useLinforgeGraph — React Hook for loading and saving graph definitions

import { useState, useEffect, useCallback, useRef } from 'react';
import type { GraphDefinition, GraphTemplate } from '../core/types';
import type { RegistryNode } from './EdgeConfigPopover';

export interface UseLinforgeGraphOptions {
  /** API base path, defaults to '/linforge' */
  apiBase?: string;
  /** Graph slug */
  slug: string;
}

export interface ApplyTemplateResult {
  /** Mapping of renamed keys (original key -> actual key) */
  renamedKeys: Record<string, string>;
}

export interface UseLinforgeGraphReturn {
  /** Graph definition data */
  graphDef: GraphDefinition | null;
  /** List of node keys without code implementation */
  skeletonKeys: string[];
  /** List of registered nodes (including routeKeys) */
  registryNodes: RegistryNode[];
  /** List of available templates */
  templates: GraphTemplate[];
  /** Whether data is loading */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Save graph definition (500ms debounce) */
  saveGraph: (graphDef: GraphDefinition) => Promise<void>;
  /** Apply a template to the current graph (calls server API, takes effect immediately) */
  applyTemplate: (templateId: string) => Promise<ApplyTemplateResult>;
}

export function useLinforgeGraph({
  apiBase = '/linforge',
  slug,
}: UseLinforgeGraphOptions): UseLinforgeGraphReturn {
  const [graphDef, setGraphDef] = useState<GraphDefinition | null>(null);
  const [skeletonKeys, setSkeletonKeys] = useState<string[]>([]);
  const [registryNodes, setRegistryNodes] = useState<RegistryNode[]>([]);
  const [templates, setTemplates] = useState<GraphTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce 定时器
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // 加载图定义 + 模板列表
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`${apiBase}/graph/${slug}`).then((res) => {
        if (!res.ok) throw new Error(`加载失败: ${res.status}`);
        return res.json();
      }),
      fetch(`${apiBase}/registry/nodes`).then((res) => {
        if (!res.ok) return { nodes: [] };
        return res.json();
      }),
      fetch(`${apiBase}/templates`).then((res) => {
        if (!res.ok) return { templates: [] };
        return res.json();
      }),
    ])
      .then(([graphData, registryData, templatesData]) => {
        if (!cancelled) {
          const { skeletonKeys: sk, ...rest } = graphData;
          setGraphDef(rest);
          setSkeletonKeys(sk || []);
          setRegistryNodes(registryData.nodes || []);
          setTemplates(templatesData.templates || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiBase, slug]);

  // 保存图定义（debounce 500ms）
  const saveGraph = useCallback(
    async (newGraphDef: GraphDefinition) => {
      // 清除之前的定时器
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      // 乐观更新：立即更新本地 graphDef，画布即刻反映变更
      setGraphDef(newGraphDef);

      // 500ms 后发送请求，响应回来后同步服务端数据
      return new Promise<void>((resolve, reject) => {
        debounceTimer.current = setTimeout(async () => {
          try {
            const res = await fetch(`${apiBase}/graph/${slug}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                nodes: newGraphDef.nodes,
                edges: newGraphDef.edges,
                name: newGraphDef.name,
              }),
            });
            if (!res.ok) throw new Error(`保存失败: ${res.status}`);
            const data = await res.json();
            const { skeletonKeys: sk, ...rest } = data;
            setGraphDef(rest);
            setSkeletonKeys(sk || []);
            resolve();
          } catch (err) {
            setError((err as Error).message);
            reject(err);
          }
        }, 500);
      });
    },
    [apiBase, slug],
  );

  // 应用模板（立即调用服务端 API，无 debounce）
  const applyTemplateAction = useCallback(
    async (templateId: string): Promise<ApplyTemplateResult> => {
      const res = await fetch(`${apiBase}/graph/${slug}/apply-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `应用模板失败: ${res.status}`);
      }
      const data = await res.json();
      const { skeletonKeys: sk, renamedKeys, ...rest } = data;
      setGraphDef(rest);
      setSkeletonKeys(sk || []);
      return { renamedKeys: renamedKeys || {} };
    },
    [apiBase, slug],
  );

  // 清理
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return {
    graphDef,
    skeletonKeys,
    registryNodes,
    templates,
    loading,
    error,
    saveGraph,
    applyTemplate: applyTemplateAction,
  };
}
