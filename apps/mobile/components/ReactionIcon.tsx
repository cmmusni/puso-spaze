// ─────────────────────────────────────────────
// components/ReactionIcon.tsx
// Single source of truth for rendering the icon for a ReactionType.
// Used by PostCard, PostDetailScreen, ReactionPickerHost, etc.
// ─────────────────────────────────────────────

import React from "react";
import { Ionicons } from "@expo/vector-icons";
import type { ReactionType } from "../../../packages/types";
import { PrayIcon, SupportIcon, LikeIcon, SadIcon } from "./ReactionIcons";

const CARE_ICON_CANDIDATES: Array<keyof typeof Ionicons.glyphMap> = [
  "heart",
  "heart-outline",
  "ellipse",
];

export function getCareIcon(): keyof typeof Ionicons.glyphMap {
  return CARE_ICON_CANDIDATES.find((name) => name in Ionicons.glyphMap) ?? "ellipse";
}

/**
 * Renders the icon for a given reaction type. The `key` includes the color
 * so React remounts the underlying <Image>/<Ionicons> when color changes —
 * Safari otherwise caches the CSS mask-image used to implement `tintColor`
 * inside compositing layers, leaving the icon stuck on its old colour after
 * a select/deselect.
 */
export function renderReactionIcon(
  type: ReactionType,
  size: number,
  color: string,
) {
  const k = `${type}-${color}`;
  if (type === "PRAY") return <PrayIcon key={k} size={size} color={color} />;
  if (type === "SUPPORT") return <SupportIcon key={k} size={size} color={color} />;
  if (type === "LIKE") return <LikeIcon key={k} size={size} color={color} />;
  if (type === "SAD") return <SadIcon key={k} size={size} color={color} />;
  return <Ionicons key={k} name={getCareIcon()} size={size} color={color} />;
}

export interface ReactionIconProps {
  type: ReactionType;
  size: number;
  color: string;
}

export function ReactionIcon({ type, size, color }: ReactionIconProps) {
  return renderReactionIcon(type, size, color);
}
