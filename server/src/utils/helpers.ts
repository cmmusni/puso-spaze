// ─────────────────────────────────────────────
// src/utils/helpers.ts
// Shared utility functions for the server
// ─────────────────────────────────────────────

/**
 * Truncates a string to a given length with an ellipsis.
 * Useful for logging long content without flooding the console.
 */
export function truncate(str: string, maxLength = 80): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength)}…`;
}

/**
 * Simple sleep helper for retry logic or testing.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Safely parses JSON, returns null on failure.
 */
export function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
