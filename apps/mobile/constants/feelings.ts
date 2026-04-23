// ─────────────────────────────────────────────
// constants/feelings.ts
// Single source of truth for feeling tags used in the post composer
// and feeling-tag display across PostCard / PostDetailScreen.
// ─────────────────────────────────────────────

export interface FeelingOption {
  key: string;
  emoji: string;
  label: string;
}

export const FEELING_OPTIONS: FeelingOption[] = [
  { key: "grateful", emoji: "\u{1F60A}", label: "Grateful" },
  { key: "prayerful", emoji: "\u{1F64F}", label: "Prayerful" },
  { key: "strong", emoji: "\u{1F4AA}", label: "Strong" },
  { key: "struggling", emoji: "\u{1F622}", label: "Struggling" },
  { key: "hopeful", emoji: "\u{1F917}", label: "Hopeful" },
  { key: "heavy-hearted", emoji: "\u{1F614}", label: "Heavy-hearted" },
  { key: "blessed", emoji: "\u2728", label: "Blessed" },
  { key: "loved", emoji: "\u2764\uFE0F", label: "Loved" },
];

/** Lookup map keyed by feeling key — for rendering feeling tags on posts. */
export const FEELING_MAP: Record<string, { emoji: string; label: string }> =
  FEELING_OPTIONS.reduce(
    (acc, f) => {
      acc[f.key] = { emoji: f.emoji, label: f.label };
      return acc;
    },
    {} as Record<string, { emoji: string; label: string }>,
  );
