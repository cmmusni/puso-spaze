// ─────────────────────────────────────────────
// utils/validators.ts
// Input validation helpers for PUSO Spaze
// ─────────────────────────────────────────────

/** Minimum and maximum post content length */
export const POST_MIN_LENGTH = 3;
export const POST_MAX_LENGTH = 500;

/** Minimum username length (non-anonymous) */
export const USERNAME_MIN_LENGTH = 2;
export const USERNAME_MAX_LENGTH = 30;

/**
 * Validates post content length before submission.
 */
export function validatePostContent(content: string): string | null {
  const trimmed = content.trim();
  if (trimmed.length < POST_MIN_LENGTH) {
    return `Post must be at least ${POST_MIN_LENGTH} characters.`;
  }
  if (trimmed.length > POST_MAX_LENGTH) {
    return `Post must be ${POST_MAX_LENGTH} characters or fewer.`;
  }
  return null; // valid
}

/**
 * Validates a custom username.
 * Returns an error string or null if valid.
 */
export function validateUsername(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < USERNAME_MIN_LENGTH) {
    return `Username must be at least ${USERNAME_MIN_LENGTH} characters.`;
  }
  if (trimmed.length > USERNAME_MAX_LENGTH) {
    return `Username must be ${USERNAME_MAX_LENGTH} characters or fewer.`;
  }
  // Only allow letters, numbers, spaces, underscores, hyphens
  if (!/^[a-zA-Z0-9 _-]+$/.test(trimmed)) {
    return 'Username can only contain letters, numbers, spaces, _ and -.';
  }
  return null;
}
