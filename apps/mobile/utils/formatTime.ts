// ─────────────────────────────────────────────
// utils/formatTime.ts
// Human-readable relative timestamps for posts/comments/messages.
// ─────────────────────────────────────────────

/**
 * Formats a UTC ISO date string into a short relative time
 * e.g. "just now", "12m", "3h", "5d".
 */
export function formatRelativeTime(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}
