// ─────────────────────────────────────────────
// src/utils/sanitize.ts
// Input sanitization utilities
// ─────────────────────────────────────────────

/**
 * Removes HTML tags and null bytes from a string.
 * HTML removal prevents stored XSS. Null byte removal prevents
 * PostgreSQL/Prisma crashes (pg driver chokes on \u0000).
 */
export function stripHtmlTags(input: string): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/<[^>]*>/g, '').replace(/\x00/g, '');
}

/**
 * Strips null bytes (\u0000) from a string.
 * PostgreSQL text columns cannot store null bytes — they cause
 * Prisma/pg driver to crash the Node.js process.
 */
export function stripNullBytes(input: string): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/\x00/g, '');
}

/**
 * Recursively strips null bytes from all string values AND keys in an object/array.
 * Used as global middleware to protect against null byte injection.
 */
export function deepStripNullBytes(value: unknown): unknown {
  if (typeof value === 'string') return stripNullBytes(value);
  if (Array.isArray(value)) return value.map(deepStripNullBytes);
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[stripNullBytes(k)] = deepStripNullBytes(v);
    }
    return result;
  }
  return value;
}

/**
 * Returns true if a string contains null bytes.
 */
export function containsNullBytes(input: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /\x00/.test(input);
}
