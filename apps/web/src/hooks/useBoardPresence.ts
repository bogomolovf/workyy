import { useEffect, useState } from 'react';
import type { Map as YMapType } from 'yjs';
import type { Cursor } from './useCursorStateSynced';
import type { PresenceUser } from '../components/UserPresenceIndicator';

/**
 * Hook to observe users present on the board from Yjs cursorsMap.
 * Can be used outside of ReactFlowProvider (unlike useCursorStateSynced).
 */
export function useBoardPresence(
  cursorsMap: YMapType<Cursor> | null,
  currentClientId?: string,
): PresenceUser[] {
  const [users, setUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!cursorsMap) return;

    const updateUsers = () => {
      const now = Date.now();
      const STALE_THRESHOLD = 15000; // 15 seconds - user is considered offline after this

      const activeUsers: PresenceUser[] = [];
      const seenUserIds = new Set<string>();

      for (const cursor of cursorsMap.values()) {
        // Skip stale cursors (user left)
        if (now - cursor.timestamp > STALE_THRESHOLD) continue;

        // Use a unique key: prefer userId, fallback to cursor id
        const uniqueKey = cursor.userId || cursor.id;

        // Avoid duplicates (same user on multiple tabs)
        if (seenUserIds.has(uniqueKey)) continue;
        seenUserIds.add(uniqueKey);

        activeUsers.push({
          id: uniqueKey,
          name: cursor.userName,
          color: cursor.color,
        });
      }

      setUsers(activeUsers);
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
