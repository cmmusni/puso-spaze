// ─────────────────────────────────────────────
// utils/avatarColors.ts
// Deterministic gradient color pair for avatar fallbacks
// (when a user has no avatarUrl, we render their initial on a gradient).
// ─────────────────────────────────────────────

import { colors as defaultColors } from "../constants/theme";

export type AvatarColorPair = [string, string];

/**
 * Returns a deterministic [start, end] gradient pair for the given initial.
 * Pass the active themed `colors` object so the palette honours dark mode;
 * defaults to the static brand palette.
 */
export function getAvatarColors(
  initial: string,
  colors: typeof defaultColors = defaultColors,
): AvatarColorPair {
  const palette: AvatarColorPair[] = [
    [colors.secondary, colors.primary],
    [colors.primaryContainer, colors.gradientStart],
    [colors.secondary, colors.primaryContainer],
    [colors.primaryContainer, colors.primary],
    [colors.secondary, colors.tertiary],
  ];
  const ch = initial?.charCodeAt(0) ?? 0;
  return palette[ch % palette.length];
}
