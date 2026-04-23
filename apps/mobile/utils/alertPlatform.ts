// ─────────────────────────────────────────────
// utils/alertPlatform.ts
// Cross-platform alert utility
// Uses the themed CustomAlertModal on both web and native
// so dialogs match the Sacred Journal design system.
// ─────────────────────────────────────────────

import { emitAlert } from '../components/CustomAlertModal';

/**
 * Show an alert that works on both native and web platforms.
 * Routes through the themed CustomAlertModal mounted in App.tsx.
 * Returns a promise that resolves when the user dismisses the alert.
 */
export function showAlert(title: string, message: string = ''): Promise<void> {
  return new Promise((resolve) => {
    emitAlert({ title, message, type: 'alert', resolve: () => resolve() });
  });
}

/**
 * Show a confirmation dialog that works on both native and web.
 * Routes through the themed CustomAlertModal mounted in App.tsx.
 * Returns promise that resolves to true if confirmed, false if cancelled.
 */
export function showConfirm(title: string, message: string = ''): Promise<boolean> {
  return new Promise((resolve) => {
    emitAlert({ title, message, type: 'confirm', resolve });
  });
}
