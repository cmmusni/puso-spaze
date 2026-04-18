// ─────────────────────────────────────────────
// utils/suppressWebMenu.ts
// Web-only helpers for buttons that use onLongPress.
// Suppresses the browser context menu (right-click +
// mobile-web long-press callout) and disables text /
// selection highlighting so the long-press feels native.
//
// React Native Web does not reliably forward the
// `onContextMenu` prop through TouchableOpacity, so we
// install ONE document-level `contextmenu` listener that
// blocks the menu for any element (or ancestor) tagged
// with `data-no-context="true"`. Components opt in by
// spreading the value returned by `suppressWebMenu()`
// (which expands to `dataSet={{ noContext: 'true' }}`;
// RN Web converts that to `data-no-context="true"` on
// the underlying DOM node).
//
// On native iOS/Android everything here is a no-op.
// ─────────────────────────────────────────────

import { Platform, type ViewStyle } from 'react-native';

// Style prop that disables text selection + iOS Safari long-press callout.
// Spread into a TouchableOpacity / Pressable `style` array on web; no-op on native.
export const noSelectStyle = (
  Platform.OS === 'web'
    ? ({
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        // Belt-and-suspenders: also block the browser default at the CSS layer
        // wherever supported. Most desktop browsers ignore this, hence the
        // global JS listener below.
        WebkitTouchAction: 'manipulation',
      } as unknown as ViewStyle)
    : null
);

// Spread onto a TouchableOpacity / Pressable / View that should not show the
// browser context menu (or iOS Safari long-press callout). The dataSet maps to
// `data-no-context="true"` on the underlying DOM node, which the global
// listener installed by `installContextMenuSuppressor()` matches against.
export function suppressWebMenu(): { dataSet?: { noContext: 'true' } } {
  if (Platform.OS !== 'web') return {};
  return { dataSet: { noContext: 'true' } };
}

// ── Install the global listener exactly once ──
let installed = false;
export function installContextMenuSuppressor(): void {
  if (installed) return;
  if (Platform.OS !== 'web') return;
  if (typeof document === 'undefined') return;

  document.addEventListener(
    'contextmenu',
    (e) => {
      const target = e.target as HTMLElement | null;
      if (!target || typeof target.closest !== 'function') return;
      if (target.closest('[data-no-context="true"]')) {
        e.preventDefault();
      }
    },
    // Capture phase so we run before any other handler.
    { capture: true },
  );

  installed = true;
}

