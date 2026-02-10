import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReactFlow } from 'reactflow';
import type { Map as YMapType } from 'yjs';
import { useCursorSettingsStore } from '../state/cursorSettingsStore';

const MAX_IDLE_TIME = 6000; // 6 seconds - remove from map so cursor disappears for everyone when user leaves
const STALE_DISPLAY_MS = 5000; // Don't show cursors older than 5s (user left / reconnected with new cursor)
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
 */
export function useCursorStateSynced(
  cursorsMap: YMapType<Cursor>,
  clientId: string,
  userInfo?: { userId?: string; userName?: string },
  options?: { showOwnCursor?: boolean }
): [Cursor[], (event: React.PointerEvent<HTMLDivElement>) => void] {
  const [cursors, setCursors] = useState<Cursor[]>([]);
  const { screenToFlowPosition } = useReactFlow();
  const lastUpdateTimeRef = useRef<number>(0);
  const previousClientIdRef = useRef<string | null>(null);

  // Use user-selected cursor color from settings store
  const cursorColor = useCursorSettingsStore((s) => s.cursorColor);

  // When user changes cursor color, update our cursor in the map immediately so the old-color
  // cursor disappears at once (no duplicate old/new cursor)
  useEffect(() => {
    if (!cursorsMap.has(clientId)) return;
    const existing = cursorsMap.get(clientId);
    if (!existing) return;
    cursorsMap.set(clientId, {
      ...existing,
      color: cursorColor,
      timestamp: Date.now(),
    });
  }, [cursorColor, cursorsMap, clientId]);

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
        color: cursorColor,
        x: position.x,
        y: position.y,
        timestamp: now,
      };

      if (userInfo?.userId) cursorData.userId = userInfo.userId;
      if (userInfo?.userName) cursorData.userName = userInfo.userName;

      cursorsMap.set(clientId, cursorData);
    },
    [screenToFlowPosition, cursorsMap, clientId, cursorColor, userInfo]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cursorsMap.has(clientId)) {
        cursorsMap.delete(clientId);
      }
    };
  }, [cursorsMap, clientId]);

  useEffect(() => {
    const timer = window.setInterval(flush, 3000); // Run flush every 3s so stale cursors are removed from map quickly
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

  // One cursor per user: keep only the latest (max timestamp) per userId/userName/clientId
  // so old-color cursor disappears when user reconnects with new color
  const cursorsDedupedByUser = useMemo(() => {
    const now = Date.now();
    const byUser = new Map<string, Cursor>();
    for (const c of cursors) {
      if (now - c.timestamp > STALE_DISPLAY_MS) continue; // Don't show stale (user left)
      const key = c.userId ?? c.userName ?? c.id;
      const existing = byUser.get(key);
      if (!existing || c.timestamp > existing.timestamp) {
        byUser.set(key, c);
      }
    }
    return [...byUser.values()];
  }, [cursors]);

  const cursorsWithoutSelf = useMemo(
    () => cursorsDedupedByUser.filter(({ id }) => id !== clientId),
    [cursorsDedupedByUser, clientId]
  );

  const cursorsToShow = useMemo(
    () => (options?.showOwnCursor ? cursorsDedupedByUser : cursorsWithoutSelf),
    [cursorsDedupedByUser, cursorsWithoutSelf, options?.showOwnCursor]
  );

  return [cursorsToShow, onMouseMove];
}
