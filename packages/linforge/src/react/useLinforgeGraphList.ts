import { useState, useEffect, useCallback, useRef } from 'react';

/** Graph list item (compact version) */
export interface GraphListItem {
  id: string;
  slug: string;
  name: string;
  icon?: string;
  nodeCount: number;
  edgeCount: number;
}

/** Parameters for creating a graph */
export interface CreateGraphInput {
  name: string;
  slug: string;
  icon?: string;
}

/** Parameters for updating graph metadata */
export interface UpdateGraphInput {
  name?: string;
  icon?: string;
}

export interface UseLinforgeGraphListReturn {
  graphs: GraphListItem[];
  loading: boolean;
  error: string | null;
  createGraph: (input: CreateGraphInput) => Promise<GraphListItem>;
  updateGraph: (slug: string, input: UpdateGraphInput) => Promise<void>;
  reload: () => void;
}

/**
 * Graph list CRUD hook
 *
 * @param apiBase API prefix (e.g. '/api/linforge')
 */
export function useLinforgeGraphList(
  apiBase: string,
): UseLinforgeGraphListReturn {
  const [graphs, setGraphs] = useState<GraphListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchGraphs = useCallback(async () => {
    // 取消上一次请求
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBase}/graphs`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setGraphs(data.graphs || []);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    fetchGraphs();
    return () => abortRef.current?.abort();
  }, [fetchGraphs]);

  const createGraph = useCallback(
    async (input: CreateGraphInput): Promise<GraphListItem> => {
      const res = await fetch(`${apiBase}/graphs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const created = await res.json();
      const listItem: GraphListItem = {
        id: created.id,
        slug: created.slug,
        name: created.name,
        icon: created.icon,
        nodeCount: created.nodes?.length || 0,
        edgeCount: created.edges?.length || 0,
      };

      // 追加到列表
      setGraphs((prev) => [listItem, ...prev]);
      return listItem;
    },
    [apiBase],
  );

  const updateGraph = useCallback(
    async (slug: string, input: UpdateGraphInput): Promise<void> => {
      const res = await fetch(`${apiBase}/graphs/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const updated = await res.json();
      // 更新列表中对应项
      setGraphs((prev) =>
        prev.map((g) =>
          g.slug === slug
            ? { ...g, name: updated.name, icon: updated.icon }
            : g,
        ),
      );
    },
    [apiBase],
  );

  return {
    graphs,
    loading,
    error,
    createGraph,
    updateGraph,
    reload: fetchGraphs,
  };
}
