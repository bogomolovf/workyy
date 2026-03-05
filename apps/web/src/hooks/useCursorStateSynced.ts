import type { RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReactFlow } from 'reactflow';
import type { Map as YMapType } from 'yjs';
import { DEFAULT_CURSOR, useCursorSettingsStore } from '../state/cursorSettingsStore';

const MAX_IDLE_TIME = 10000; // 10 seconds
// Optimized throttle for smooth 60 FPS cursor movement (~16.67ms per frame)
const CURSOR_THROTTLE_MS = 16; // Throttle cursor updates to max once per 16ms (60 FPS)

export type Cursor = {
  id: string;
  color: string;
  x: number;
  y: number;
  timestamp: number;
  userId?: string; // User ID from auth
  userName?: string; // User name or email for display
};

/**
 * Hook for syncing cursor positions through Yjs YMap
 * Based on collaborative-11-pro-example pattern
 * Enhanced with throttle optimization and user information support
 *
 * @param boardContainerRef - Ref to the board container element. When provided, cursor is removed
 *   when pointer moves outside this element (document-level check, more reliable than pointerleave)
 */
export function useCursorStateSynced(
  cursorsMap: YMapType<Cursor>,
  clientId: string,
  userInfo?: { userId?: string; userName?: string },
  options?: { showOwnCursor?: boolean; boardContainerRef?: RefObject<HTMLElement | null> },
): [
  Cursor[],
  (event: React.PointerEvent<HTMLDivElement>) => void,
  (event: React.PointerEvent<HTMLDivElement>) => void,
] {
  const [cursors, setCursors] = useState<Cursor[]>([]);
  const { screenToFlowPosition } = useReactFlow();
  const lastUpdateTimeRef = useRef<number>(0);
  const previousClientIdRef = useRef<string | null>(null);

  // Use user-selected cursor color from settings store
  // When 'default', use neutral color for sync (other users see cursor) — own overlay is hidden
  const cursorColor = useCursorSettingsStore((s) => s.cursorColor);
  const colorForSync = cursorColor === DEFAULT_CURSOR ? '#94a3b8' : cursorColor;

  // CRITICAL FIX: Remove old cursor entries that belong to this user but have different clientId
  // This prevents duplicate cursors after page refresh when Yjs creates a new clientId
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    // Only run cleanup logic once on initialization or when clientId changes
    if (hasInitializedRef.current && previousClientIdRef.current === clientId) {
      return;
    }

    // Remove old cursor entry when clientId changes (e.g., after page refresh)
    if (previousClientIdRef.current !== null && previousClientIdRef.current !== clientId) {
      if (cursorsMap.has(previousClientIdRef.current)) {
        cursorsMap.delete(previousClientIdRef.current);
      }
    }

    // On first initialization, remove cursors that belong to the same user but have different clientId
    if (!hasInitializedRef.current) {
      for (const [id, cursor] of cursorsMap) {
        if (id !== clientId) {
          const isSameUser =
            (userInfo?.userId && cursor.userId === userInfo.userId) ||
            (userInfo?.userName && cursor.userName === userInfo.userName);

          if (isSameUser) {
            cursorsMap.delete(id);
          }
        }
      }
    }

    previousClientIdRef.current = clientId;
    hasInitializedRef.current = true;
  }, [clientId, cursorsMap, userInfo]);

  // Flush any cursors that have gone stale.
  const flush = useCallback(() => {
    const now = Date.now();

    for (const [id, cursor] of cursorsMap) {
      if (now - cursor.timestamp > MAX_IDLE_TIME) {
        cursorsMap.delete(id);
      }
    }
  }, [cursorsMap]);

  const onMouseMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      // Ensure clientX/clientY are available
      if (typeof event.clientX !== 'number' || typeof event.clientY !== 'number') {
        return;
      }

      const now = Date.now();
      const timeSinceLast = now - lastUpdateTimeRef.current;

      // Simple throttle - skip if too soon
      if (timeSinceLast < CURSOR_THROTTLE_MS) {
        return;
      }

      lastUpdateTimeRef.current = now;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const cursorData: Cursor = {
        id: clientId,
        color: colorForSync,
        x: position.x,
        y: position.y,
        timestamp: now,
      };

      if (userInfo?.userId) cursorData.userId = userInfo.userId;
      if (userInfo?.userName) cursorData.userName = userInfo.userName;

      cursorsMap.set(clientId, cursorData);
    },
    [screenToFlowPosition, cursorsMap, clientId, colorForSync, userInfo],
  );

  // Remove own cursor when pointer leaves the board — prevents cursor stuck at edge
  const onPointerLeave = useCallback(() => {
    cursorsMap.delete(clientId);
  }, [cursorsMap, clientId]);

  // Document-level check: when pointer moves outside board container, remove cursor
  // More reliable than pointerleave when moving to header, sidebar, another tab, or out of window
  const boardRef = options?.boardContainerRef;
  useEffect(() => {
    if (!boardRef) return;
    const onPointerMove = (e: PointerEvent) => {
      const el = boardRef.current;
      if (!el) return;
      if (!cursorsMap.has(clientId)) return;
      const target = e.target as Node | null;
      if (target && el.contains(target)) return;
      cursorsMap.delete(clientId);
    };
    const onDocumentPointerLeave = () => {
      cursorsMap.delete(clientId);
    };
    document.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerleave', onDocumentPointerLeave);
    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerleave', onDocumentPointerLeave);
    };
  }, [boardRef, cursorsMap, clientId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cursorsMap.has(clientId)) {
        cursorsMap.delete(clientId);
      }
    };
  }, [cursorsMap, clientId]);

  useEffect(() => {
    const timer = window.setInterval(flush, MAX_IDLE_TIME);

    // Update cursors immediately without RAF for instant response
    const observer = () => {
      setCursors([...cursorsMap.values()]);
    };

    flush();
    setCursors([...cursorsMap.values()]);
    cursorsMap.observe(observer);

    return () => {
      cursorsMap.unobserve(observer);
      window.clearInterval(timer);
    };
  }, [flush, cursorsMap]);

  const cursorsWithoutSelf = useMemo(
    () => cursors.filter(({ id }) => id !== clientId),
    [cursors, clientId],
  );

  const cursorsToShow = useMemo(
    () => (options?.showOwnCursor ? cursors : cursorsWithoutSelf),
    [cursors, cursorsWithoutSelf, options?.showOwnCursor],
  );

  return [cursorsToShow, onMouseMove, onPointerLeave];
}
