// ─────────────────────────────────────────────
// hooks/useWebPullToRefresh.ts
// Custom pull-to-refresh for web/PWA. No-op on native
// (use <RefreshControl/> there). Attach the returned
// `attach` function to a scrollable DOM node — e.g. the
// node returned by FlatList.getScrollableNode().
// ─────────────────────────────────────────────

import { Platform } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Options {
  /** Called when user releases past threshold. */
  onRefresh: () => Promise<unknown> | void;
  /** Px of pull required to trigger refresh. Default 70. */
  threshold?: number;
  /** Max visual pull distance (damped). Default 110. */
  maxPull?: number;
  /** Disable PTR (e.g. while a modal is open). */
  enabled?: boolean;
}

interface Result {
  /** Attach to a scrollable DOM node. Pass null to detach. */
  attach: (node: any) => void;
  /** Current pull distance in px (0 when idle). */
  pullDistance: number;
  /** True while onRefresh is in-flight. */
  refreshing: boolean;
  /** True once user has crossed the trigger threshold. */
  willTrigger: boolean;
}

const NOOP_RESULT: Result = {
  attach: () => {},
  pullDistance: 0,
  refreshing: false,
  willTrigger: false,
};

export function useWebPullToRefresh({
  onRefresh,
  threshold = 70,
  maxPull = 110,
  enabled = true,
}: Options): Result {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const nodeRef = useRef<any>(null);
  const startYRef = useRef<number | null>(null);
  const activeRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const enabledRef = useRef(enabled);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  const thresholdRef = useRef(threshold);
  const maxPullRef = useRef(maxPull);

  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);
  useEffect(() => { refreshingRef.current = refreshing; }, [refreshing]);
  useEffect(() => { thresholdRef.current = threshold; }, [threshold]);
  useEffect(() => { maxPullRef.current = maxPull; }, [maxPull]);

  const setPull = useCallback((v: number) => {
    pullDistanceRef.current = v;
    setPullDistance(v);
  }, []);

  const triggerRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    setPull(thresholdRef.current); // hold spinner at trigger point
    try {
      await Promise.resolve(onRefreshRef.current());
    } catch {
      // swallow — caller handles errors
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
      setPull(0);
    }
  }, [setPull]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let currentNode: any = null;

    const dampen = (raw: number): number => {
      const eased = Math.pow(Math.max(0, raw), 0.85);
      return Math.min(maxPullRef.current, eased);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (!enabledRef.current || refreshingRef.current) return;
      if (!currentNode || currentNode.scrollTop > 0) {
        startYRef.current = null;
        return;
      }
      startYRef.current = e.touches[0].clientY;
      activeRef.current = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!enabledRef.current || refreshingRef.current) return;
      if (startYRef.current == null || !currentNode) return;
      if (currentNode.scrollTop > 0) {
        if (activeRef.current) {
          activeRef.current = false;
          setPull(0);
        }
        startYRef.current = null;
        return;
      }
      const delta = e.touches[0].clientY - startYRef.current;
      if (delta <= 0) {
        if (activeRef.current) {
          activeRef.current = false;
          setPull(0);
        }
        return;
      }
      activeRef.current = true;
      // Block browser native pull (Chrome Android PWA refresh, iOS rubber-band)
      if (e.cancelable) e.preventDefault();
      setPull(dampen(delta));
    };

    const handleTouchEnd = () => {
      if (!activeRef.current) {
        startYRef.current = null;
        return;
      }
      const distance = pullDistanceRef.current;
      activeRef.current = false;
      startYRef.current = null;
      if (distance >= thresholdRef.current) {
        triggerRefresh();
      } else {
        setPull(0);
      }
    };

    const handleTouchCancel = () => {
      startYRef.current = null;
      activeRef.current = false;
      setPull(0);
    };

    const attachListeners = (node: any) => {
      currentNode = node;
      if (!node || typeof node.addEventListener !== 'function') return;
      node.addEventListener('touchstart', handleTouchStart, { passive: true });
      node.addEventListener('touchmove', handleTouchMove, { passive: false });
      node.addEventListener('touchend', handleTouchEnd, { passive: true });
      node.addEventListener('touchcancel', handleTouchCancel, { passive: true });
      try {
        if (node.style) node.style.overscrollBehaviorY = 'contain';
      } catch {
        // ignore
      }
    };

    const detachListeners = (node: any) => {
      if (!node || typeof node.removeEventListener !== 'function') return;
      node.removeEventListener('touchstart', handleTouchStart);
      node.removeEventListener('touchmove', handleTouchMove);
      node.removeEventListener('touchend', handleTouchEnd);
      node.removeEventListener('touchcancel', handleTouchCancel);
    };

    // Poll the public node ref so consumers can call `attach(node)` at any time
    // (e.g. once FlatList mounts or remounts) without re-running this effect.
    const observer = setInterval(() => {
      if (nodeRef.current !== currentNode) {
        if (currentNode) detachListeners(currentNode);
        attachListeners(nodeRef.current);
      }
    }, 250);

    return () => {
      clearInterval(observer);
      detachListeners(currentNode);
    };
  }, [setPull, triggerRefresh]);

  const attach = useCallback((node: any) => {
    nodeRef.current = node;
  }, []);

  if (Platform.OS !== 'web') return NOOP_RESULT;

  return {
    attach,
    pullDistance,
    refreshing,
    willTrigger: pullDistance >= threshold,
  };
}
