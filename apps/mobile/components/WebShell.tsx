// ─────────────────────────────────────────────
// components/WebShell.tsx
// On web: injects global CSS for responsive layout.
// No-op on native platforms.
// ─────────────────────────────────────────────

import React, { useEffect } from "react";
import { Platform } from "react-native";
import { colors, fonts } from "../constants/theme";

const SKIP_SPLASH_SESSION_KEY = "puso-skip-splash-once";

interface Props {
  children: React.ReactNode;
}

export default function WebShell({ children }: Props) {
  useEffect(() => {
    if (Platform.OS !== "web") return;

    // Inject global CSS to make the app fill the viewport
    const style = document.createElement("style");
    style.textContent = `
      html, body, #root {
        height: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
        -webkit-text-size-adjust: 100%;
      }
    `;
    document.head.appendChild(style);

    const supportsTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (supportsTouch) {
      style.textContent += `
        input,
        textarea,
        select,
        [contenteditable="true"] {
          font-size: 16px !important;
        }
      `;
    }

    if (!supportsTouch) {
      return () => { document.head.removeChild(style); };
    }

    const indicator = document.createElement("div");
    indicator.textContent = "Pull to refresh";
    indicator.style.position = "fixed";
    indicator.style.top = "0";
    indicator.style.left = "50%";
    indicator.style.transform = "translate(-50%, -56px)";
    indicator.style.opacity = "0";
    indicator.style.pointerEvents = "none";
    indicator.style.zIndex = "9999";
    indicator.style.padding = "10px 14px";
    indicator.style.borderRadius = "9999px";
    indicator.style.background = colors.primary;
    indicator.style.color = colors.card;
    indicator.style.fontFamily = fonts.bodySemiBold;
    indicator.style.fontSize = "13px";
    indicator.style.boxShadow = "0 10px 30px rgba(124, 0, 58, 0.18)";
    indicator.style.transition = "transform 160ms ease, opacity 160ms ease";
    document.body.appendChild(indicator);

    const maxPullDistance = 96;
    const triggerDistance = 72;
    let startY = 0;
    let isPulling = false;
    let shouldRefresh = false;
    let activeScroller: HTMLElement | null = null;

    const isFormTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
    };

    const getScrollableParent = (target: EventTarget | null) => {
      let node = target instanceof HTMLElement ? target : null;
      while (node && node !== document.body) {
        const computed = window.getComputedStyle(node);
        const canScrollY = /(auto|scroll)/.test(computed.overflowY) && node.scrollHeight > node.clientHeight + 1;
        if (canScrollY) return node;
        node = node.parentElement;
      }
      return document.scrollingElement instanceof HTMLElement ? document.scrollingElement : null;
    };

    const atTop = (node: HTMLElement | null) => !node || node.scrollTop <= 0;

    const resetIndicator = () => {
      indicator.textContent = "Pull to refresh";
      indicator.style.transform = "translate(-50%, -56px)";
      indicator.style.opacity = "0";
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || isFormTarget(event.target)) return;
      activeScroller = getScrollableParent(event.target);
      if (!atTop(activeScroller)) {
        isPulling = false;
        shouldRefresh = false;
        return;
      }
      startY = event.touches[0].clientY;
      isPulling = true;
      shouldRefresh = false;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!isPulling) return;
      if (!atTop(activeScroller)) {
        isPulling = false;
        shouldRefresh = false;
        resetIndicator();
        return;
      }

      const deltaY = Math.max(0, event.touches[0].clientY - startY);
      if (deltaY <= 0) {
        resetIndicator();
        return;
      }

      const dampedDistance = Math.min(maxPullDistance, deltaY * 0.45);
      shouldRefresh = dampedDistance >= triggerDistance;
      indicator.textContent = shouldRefresh ? "Release to refresh" : "Pull to refresh";
      indicator.style.transform = `translate(-50%, ${-56 + dampedDistance}px)`;
      indicator.style.opacity = String(Math.min(1, dampedDistance / 36));

      if (event.cancelable) {
        event.preventDefault();
      }
    };

    const onTouchEnd = () => {
      if (!isPulling) return;
      isPulling = false;

      if (shouldRefresh) {
        indicator.textContent = "Refreshing...";
        indicator.style.transform = "translate(-50%, 16px)";
        indicator.style.opacity = "1";
        try {
          window.sessionStorage.setItem(SKIP_SPLASH_SESSION_KEY, "1");
        } catch {}
        window.location.reload();
        return;
      }

      shouldRefresh = false;
      resetIndicator();
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("touchcancel", onTouchEnd);

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
      document.body.removeChild(indicator);
      document.head.removeChild(style);
    };
  }, []);

  return <>{children}</>;
}
