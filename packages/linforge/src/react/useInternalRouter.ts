import { useState, useEffect, useCallback } from 'react';

export interface UseInternalRouterReturn {
  /** Current slug (null means on the list page) */
  currentSlug: string | null;
  /** Navigate to a graph's canvas page */
  navigateTo: (slug: string) => void;
  /** Navigate back to the list page */
  navigateToList: () => void;
}

/**
 * Self-managed router hook — based on history.pushState + popstate
 * Zero router dependency, parses currentSlug from URL path
 *
 * @param basePath Route prefix (e.g. '/linforge')
 */
export function useInternalRouter(basePath: string): UseInternalRouterReturn {
  const parseSlug = useCallback((): string | null => {
    const path = window.location.pathname;
    // 去掉 basePath 前缀，提取剩余部分
    const normalizedBase = basePath.endsWith('/')
      ? basePath.slice(0, -1)
      : basePath;
    if (!path.startsWith(normalizedBase)) return null;
    const rest = path.slice(normalizedBase.length);
    // rest 应为 '' 或 '/' 或 '/:slug'
    if (!rest || rest === '/') return null;
    const slug = rest.startsWith('/') ? rest.slice(1) : rest;
    // 去掉可能的尾部 '/'
    const cleanSlug = slug.replace(/\/$/, '');
    return cleanSlug || null;
  }, [basePath]);

  const [currentSlug, setCurrentSlug] = useState<string | null>(parseSlug);

  // 监听 popstate（浏览器后退/前进）
  useEffect(() => {
    const handlePopState = () => {
      setCurrentSlug(parseSlug());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [parseSlug]);

  const navigateTo = useCallback(
    (slug: string) => {
      const normalizedBase = basePath.endsWith('/')
        ? basePath.slice(0, -1)
        : basePath;
      const url = `${normalizedBase}/${slug}`;
      window.history.pushState(null, '', url);
      setCurrentSlug(slug);
    },
    [basePath],
  );

  const navigateToList = useCallback(() => {
    const normalizedBase = basePath.endsWith('/')
      ? basePath.slice(0, -1)
      : basePath;
    window.history.pushState(null, '', normalizedBase);
    setCurrentSlug(null);
  }, [basePath]);

  return { currentSlug, navigateTo, navigateToList };
}
