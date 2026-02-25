// formatUtils — Display utility functions

/**
 * Format duration
 * < 1000ms -> "100ms"
 * < 60s -> "1.5s"
 * >= 60s -> "1.5min"
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}min`;
}

/**
 * Format token count
 * < 1000 -> "500"
 * >= 1000 -> "12.3k"
 */
export function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1)}k`;
}

/**
 * Format relative time
 * < 1 minute -> "just now"
 * < 60 minutes -> "15 min ago"
 * < 24 hours -> "3 hours ago"
 * >= 24 hours -> "1 day ago"
 */
export function formatRelativeTime(date: Date | string): string {
  const now = Date.now();
  const then =
    typeof date === 'string' ? new Date(date).getTime() : date.getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHour = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHour < 24) return `${diffHour}小时前`;
  return `${diffDay}天前`;
}
