// useLinforgePrompt — Prompt version management hook
// Fetches active version + version list + saves new versions + activates versions

import { useState, useEffect, useCallback, useRef } from 'react';

export interface PromptVersionData {
  id: string;
  nodeId: string;
  version: number;
  template: string;
  temperature: number;
  isActive: boolean;
  createdAt: string;
}

export interface UseLinforgePromptOptions {
  apiBase: string;
  nodeId: string | null;
}

export interface UseLinforgePromptReturn {
  /** Currently active version */
  active: PromptVersionData | null;
  /** All versions list (descending order) */
  versions: PromptVersionData[];
  /** Whether data is loading */
  loading: boolean;
  /** Error message */
  error: string | null;
  /** Save as new version (not activated by default) */
  createVersion: (
    template: string,
    temperature?: number,
  ) => Promise<PromptVersionData | null>;
  /** Activate a specific version */
  activateVersion: (versionId: string) => Promise<boolean>;
  /** Reload data */
  reload: () => void;
}

export function useLinforgePrompt(
  options: UseLinforgePromptOptions,
): UseLinforgePromptReturn {
  const { apiBase, nodeId } = options;

  const [active, setActive] = useState<PromptVersionData | null>(null);
  const [versions, setVersions] = useState<PromptVersionData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const abortRef = useRef<AbortController | null>(null);

  // 加载版本列表 + 活跃版本
  useEffect(() => {
    if (!nodeId) {
      setActive(null);
      setVersions([]);
      setError(null);
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`${apiBase}/prompts/${nodeId}`, { signal: ctrl.signal }).then(
        (r) => (r.ok ? r.json() : null),
      ),
      fetch(`${apiBase}/prompts/${nodeId}/active`, {
        signal: ctrl.signal,
      }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([listData, activeData]) => {
        if (ctrl.signal.aborted) return;
        setVersions(listData?.versions ?? []);
        setActive(activeData ?? null);
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name === 'AbortError') return;
        setError('加载 Prompt 失败');
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });

    return () => ctrl.abort();
  }, [apiBase, nodeId, reloadTick]);

  const reload = useCallback(() => {
    setReloadTick((t) => t + 1);
  }, []);

  const createVersion = useCallback(
    async (
      template: string,
      temperature?: number,
    ): Promise<PromptVersionData | null> => {
      if (!nodeId) return null;

      try {
        const body: Record<string, unknown> = { template };
        if (temperature !== undefined) body.temperature = temperature;

        const res = await fetch(`${apiBase}/prompts/${nodeId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) return null;

        const newVersion = (await res.json()) as PromptVersionData;
        // 更新本地状态：新版本插到列表头部
        setVersions((prev) => [newVersion, ...prev]);
        return newVersion;
      } catch {
        return null;
      }
    },
    [apiBase, nodeId],
  );

  const activateVersion = useCallback(
    async (versionId: string): Promise<boolean> => {
      if (!nodeId) return false;

      try {
        const res = await fetch(
          `${apiBase}/prompts/${nodeId}/versions/${versionId}/activate`,
          { method: 'POST' },
        );

        if (!res.ok) return false;

        // 更新本地状态：互斥激活
        setVersions((prev) =>
          prev.map((v) => ({ ...v, isActive: v.id === versionId })),
        );
        setActive(
          (prev) =>
            versions.find((v) => v.id === versionId) ??
            (prev ? { ...prev, isActive: false } : null),
        );
        // 重新拉取确保一致
        setReloadTick((t) => t + 1);
        return true;
      } catch {
        return false;
      }
    },
    [apiBase, nodeId, versions],
  );

  return {
    active,
    versions,
    loading,
    error,
    createVersion,
    activateVersion,
    reload,
  };
}
