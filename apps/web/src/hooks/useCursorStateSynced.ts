import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReactFlow } from 'reactflow';
import type { Map as YMapType } from 'yjs';
import { useCursorSettingsStore } from '../state/cursorSettingsStore';

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
 */
export function useCursorStateSynced(
  cursorsMap: YMapType<Cursor>,
  clientId: string,
  userInfo?: { userId?: string; userName?: string },
  options?: { showOwnCursor?: boolean },
): [Cursor[], (event: React.PointerEvent<HTMLDivElement>) => void] {
  const [cursors, setCursors] = useState<Cursor[]>([]);
  const { screenToFlowPosition } = useReactFlow();
  const throttleTimerRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const observerRafRef = useRef<number | null>(null);
  const previousClientIdRef = useRef<string | null>(null);

  // Use user-selected cursor color from settings store
  const cursorColor = useCursorSettingsStore((s) => s.cursorColor);

  // CRITICAL FIX: Remove old cursor entries that belong to this user but have different clientId
  // This prevents duplicate cursors after page refresh when Yjs creates a new clientId
  useEffect(() => {
    const now = Date.now();
    const staleThreshold = 5000; // 5 seconds

    for (const [id, cursor] of cursorsMap) {
      // Remove cursor if:
      // 1. It has a different clientId AND
      // 2. It belongs to the same user (same userId or userName) OR it's stale (older than 5 seconds)
      if (id !== clientId) {
        const isSameUser =
          (userInfo?.userId && cursor.userId === userInfo.userId) ||
          (userInfo?.userName && cursor.userName === userInfo.userName);
        const isStale = now - cursor.timestamp > staleThreshold;

        if (isSameUser || isStale) {
          cursorsMap.delete(id);
        }
      }
    }

    // CRITICAL FIX: Remove old cursor entry when clientId changes (e.g., after page refresh)
    // This prevents duplicate cursors from appearing after page refresh
    if (previousClientIdRef.current !== null && previousClientIdRef.current !== clientId) {
      // Delete the old cursor entry from cursorsMap to prevent duplication
      if (cursorsMap.has(previousClientIdRef.current)) {
        cursorsMap.delete(previousClientIdRef.current);
      }
    }
    previousClientIdRef.current = clientId;
  }, [clientId, cursorsMap, userInfo]);

  // Flush any cursors that have gone stale.
  const flush = useCallback(() => {
    const now = Date.now();
    const beforeSize = cursorsMap.size;
    const deletedIds: string[] = [];

    for (const [id, cursor] of cursorsMap) {
      if (now - cursor.timestamp > MAX_IDLE_TIME) {
        cursorsMap.delete(id);
        deletedIds.push(id);
      }
    }
  }, [cursorsMap, clientId]);

  const onMouseMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      // Ensure clientX/clientY are available
      if (typeof event.clientX !== 'number' || typeof event.clientY !== 'number') {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[CursorSync] Missing clientX/clientY in event:', event);
        }
        return;
      }

      const now = Date.now();

      // Optimized throttle: use requestAnimationFrame for smooth 60 FPS updates
      // This ensures updates are synchronized with browser rendering
      if (now - lastUpdateTimeRef.current < CURSOR_THROTTLE_MS) {
        // Cancel previous scheduled update if it exists
        if (throttleTimerRef.current !== null) {
          window.cancelAnimationFrame(throttleTimerRef.current);
        }

        // Schedule update for next animation frame (synchronized with browser rendering)
        throttleTimerRef.current = window.requestAnimationFrame(() => {
          const position = screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          });

          const cursorData: Cursor = {
            id: clientId,
            color: cursorColor,
            x: position.x,
            y: position.y,
            timestamp: Date.now(),
          };

          // Add user information if provided
          if (userInfo?.userId) {
            cursorData.userId = userInfo.userId;
          }
          if (userInfo?.userName) {
            cursorData.userName = userInfo.userName;
          }

          cursorsMap.set(clientId, cursorData);
          lastUpdateTimeRef.current = Date.now();
          throttleTimerRef.current = null;
        });
      } else {
        // Update immediately if enough time has passed (use requestAnimationFrame for consistency)
        // This ensures all updates are synchronized with browser rendering
        if (throttleTimerRef.current !== null) {
          window.cancelAnimationFrame(throttleTimerRef.current);
        }

        throttleTimerRef.current = window.requestAnimationFrame(() => {
          const position = screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          });

          const cursorData: Cursor = {
            id: clientId,
            color: cursorColor,
            x: position.x,
            y: position.y,
            timestamp: Date.now(),
          };

          // Add user information if provided
          if (userInfo?.userId) {
            cursorData.userId = userInfo.userId;
          }
          if (userInfo?.userName) {
            cursorData.userName = userInfo.userName;
          }

          cursorsMap.set(clientId, cursorData);
          lastUpdateTimeRef.current = Date.now();
          throttleTimerRef.current = null;
        });
      }
    },
    [screenToFlowPosition, cursorsMap, clientId, cursorColor, userInfo],
  );

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (throttleTimerRef.current !== null) {
        window.cancelAnimationFrame(throttleTimerRef.current);
      }
      // CRITICAL FIX: Remove this client's cursor from cursorsMap when component unmounts
      // This prevents duplicate cursors after page refresh
      if (cursorsMap.has(clientId)) {
        cursorsMap.delete(clientId);
      }
    };
  }, [cursorsMap, clientId]);

  useEffect(() => {
    const timer = window.setInterval(flush, MAX_IDLE_TIME);
    // Use requestAnimationFrame to synchronize state updates with browser rendering
    // This ensures smooth cursor movement without jittering
    const observer = () => {
      // Cancel previous frame if exists
      if (observerRafRef.current !== null) {
        window.cancelAnimationFrame(observerRafRef.current);
      }

      // Schedule update for next animation frame
      observerRafRef.current = window.requestAnimationFrame(() => {
        const allCursors = [...cursorsMap.values()];
        setCursors(allCursors);
        observerRafRef.current = null;

        // Debug logging in development
        if (process.env.NODE_ENV === 'development') {
          console.log('[CursorSync] Cursors map updated:', {
            mapSize: cursorsMap.size,
            totalCursors: allCursors.length,
            cursors: allCursors.map((c) => ({
              id: c.id,
              clientId,
              isSelf: c.id === clientId,
              hasUserName: !!c.userName,
              timestamp: c.timestamp,
            })),
            receivedFromOtherClients: allCursors.filter((c) => c.id !== clientId).length,
          });
        }
      });
    };

    flush();
    setCursors([...cursorsMap.values()]);
    cursorsMap.observe(observer);

    return () => {
      cursorsMap.unobserve(observer);
      window.clearInterval(timer);
      // Cancel pending animation frame on cleanup
      if (observerRafRef.current !== null) {
        window.cancelAnimationFrame(observerRafRef.current);
        observerRafRef.current = null;
      }
    };
  }, [flush, cursorsMap, clientId]);

  const cursorsWithoutSelf = useMemo(
    () => cursors.filter(({ id }) => id !== clientId),
    [cursors, clientId],
  );

  // Determine which cursors to show based on options
  const cursorsToShow = useMemo(
    () => (options?.showOwnCursor ? cursors : cursorsWithoutSelf),
    [cursors, cursorsWithoutSelf, options?.showOwnCursor],
  );

  // Debug logging in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[CursorSync] Cursor state:', {
        allCursors: cursors.length,
        cursorsWithoutSelf: cursorsWithoutSelf.length,
        cursorsToShow: cursorsToShow.length,
        mapSize: cursorsMap.size,
        showOwnCursor: options?.showOwnCursor ?? false,
        clientId,
      });
    }
  }, [
    cursors.length,
    cursorsWithoutSelf.length,
    cursorsToShow.length,
    cursorsMap.size,
    options?.showOwnCursor,
    clientId,
  ]);

  return [cursorsToShow, onMouseMove];
}
