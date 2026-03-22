import { useEffect, useState } from 'react';
import type { Map as YMapType } from 'yjs';
import type { Cursor } from './useCursorStateSynced';
import type { PresenceUser } from '../components/UserPresenceIndicator';

/**
 * Hook to observe users present on the board from Yjs cursorsMap.
 * Can be used outside of ReactFlowProvider (unlike useCursorStateSynced).
 *
 * Accepts YMapType<unknown> for compatibility with ydoc.getMap() which returns
 * untyped maps. Values are cast to Cursor at read time.
 */
export function useBoardPresence(
  cursorsMap: YMapType<unknown> | null,
  currentClientId?: string,
): PresenceUser[] {
  const [users, setUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!cursorsMap) return;

    const updateUsers = () => {
      const now = Date.now();
      const STALE_THRESHOLD = 5000; // 5 seconds - user is considered offline so online count updates quickly

      // One entry per user: keep the cursor with latest timestamp (new color when reconnected)
      const latestByUser = new Map<string, { cursor: Cursor; timestamp: number }>();
      for (const raw of cursorsMap.values()) {
        const cursor = raw as Cursor;
        if (now - cursor.timestamp > STALE_THRESHOLD) continue;
        const uniqueKey = cursor.userId ?? cursor.userName ?? cursor.id;
        const existing = latestByUser.get(uniqueKey);
        if (!existing || cursor.timestamp > existing.timestamp) {
          latestByUser.set(uniqueKey, { cursor, timestamp: cursor.timestamp });
        }
      }

      const activeUsers: PresenceUser[] = [...latestByUser.values()].map(({ cursor }) => ({
        id: cursor.userId ?? cursor.userName ?? cursor.id,
        name: cursor.userName,
        color: cursor.color,
      }));

      // Only update state if the user list actually changed (prevents render loops)
      setUsers((prev) => {
        if (prev.length !== activeUsers.length) return activeUsers;
        const changed = activeUsers.some(
          (u, i) => u.id !== prev[i]?.id || u.name !== prev[i]?.name,
        );
        return changed ? activeUsers : prev;
      });
    };

    // Initial update
    updateUsers();

    // Observe changes
    const observer = () => {
      updateUsers();
    };

    cursorsMap.observe(observer);

    // Also poll periodically to handle stale cursor cleanup
    const interval = setInterval(updateUsers, 5000);

    return () => {
      cursorsMap.unobserve(observer);
      clearInterval(interval);
    };
  }, [cursorsMap, currentClientId]);

  return users;
}
