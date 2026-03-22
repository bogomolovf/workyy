import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Map as YMapType } from 'yjs';

/**
 * Represents a user editing a node
 */
export type EditingUser = {
  nodeId: string;
  clientId: string;
  userId?: string;
  userName?: string;
  color: string;
  timestamp: number;
};

/**
 * Map of nodeId -> EditingUser[] (multiple users can edit different parts)
 */
export type EditingMapValue = EditingUser;

const EDITING_TIMEOUT = 5000; // Consider user stopped editing after 5s of no updates

/**
 * Hook for tracking which users are editing which nodes
 * Uses Yjs YMap for real-time synchronization
 */
export function useEditingPresence(
  editingMap: YMapType<EditingMapValue> | undefined,
  clientId: string | undefined,
  userInfo?: { userId?: string; userName?: string; color?: string },
) {
  const [editingUsers, setEditingUsers] = useState<Map<string, EditingUser[]>>(new Map());
  const updateTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Get all users editing a specific node (excluding self)
  const getEditorsForNode = useCallback(
    (nodeId: string): EditingUser[] => {
      const editors = editingUsers.get(nodeId) || [];
      return editors.filter((e) => e.clientId !== clientId);
    },
    [editingUsers, clientId],
  );

  // Mark that current user started editing a node
  const startEditing = useCallback(
    (nodeId: string) => {
      if (!editingMap || !clientId) return;

      const editingUser: EditingUser = {
        nodeId,
        clientId,
        userId: userInfo?.userId,
        userName: userInfo?.userName,
        color: userInfo?.color || '#6366f1', // Default indigo
        timestamp: Date.now(),
      };

      // Use composite key: clientId:nodeId to allow tracking multiple nodes per user
      const key = `${clientId}:${nodeId}`;
      editingMap.set(key, editingUser);

      // Clear any existing timeout for this node
      const existingTimeout = updateTimeoutRef.current.get(nodeId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        updateTimeoutRef.current.delete(nodeId);
      }
    },
    [editingMap, clientId, userInfo],
  );

  // Update editing timestamp (call this on every keystroke/change)
  const updateEditing = useCallback(
    (nodeId: string) => {
      if (!editingMap || !clientId) return;

      const key = `${clientId}:${nodeId}`;
      const existing = editingMap.get(key);

      if (existing) {
        editingMap.set(key, {
          ...existing,
          timestamp: Date.now(),
        });
      } else {
        // If not already editing, start editing
        startEditing(nodeId);
      }
    },
    [editingMap, clientId, startEditing],
  );

  // Mark that current user stopped editing a node
  const stopEditing = useCallback(
    (nodeId: string) => {
      if (!editingMap || !clientId) return;

      const key = `${clientId}:${nodeId}`;
      if (editingMap.has(key)) {
        editingMap.delete(key);
      }

      // Clear timeout
      const existingTimeout = updateTimeoutRef.current.get(nodeId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        updateTimeoutRef.current.delete(nodeId);
      }
    },
    [editingMap, clientId],
  );

  // Stop editing all nodes (call on unmount or disconnect)
  const stopEditingAll = useCallback(() => {
    if (!editingMap || !clientId) return;

    // Remove all entries for this client
    for (const [key] of editingMap) {
      if (key.startsWith(`${clientId}:`)) {
        editingMap.delete(key);
      }
    }

    // Clear all timeouts
    for (const timeout of updateTimeoutRef.current.values()) {
      clearTimeout(timeout);
    }
    updateTimeoutRef.current.clear();
  }, [editingMap, clientId]);

  // Observer for editingMap changes
  useEffect(() => {
    if (!editingMap) return;

    const updateState = () => {
      const now = Date.now();
      const newMap = new Map<string, EditingUser[]>();

      for (const [key, user] of editingMap) {
        // Skip stale entries (older than EDITING_TIMEOUT)
        if (now - user.timestamp > EDITING_TIMEOUT) {
          // Clean up stale entry
          editingMap.delete(key);
          continue;
        }

        const existing = newMap.get(user.nodeId) || [];
        // Avoid duplicates
        if (!existing.some((e) => e.clientId === user.clientId)) {
          existing.push(user);
        }
        newMap.set(user.nodeId, existing);
      }

      setEditingUsers(newMap);
    };

    // Initial update
    updateState();

    // Observe changes
    const observer = () => {
      updateState();
    };

    editingMap.observe(observer);

    // Periodic cleanup of stale entries
    const cleanupInterval = setInterval(updateState, EDITING_TIMEOUT / 2);

    return () => {
      editingMap.unobserve(observer);
      clearInterval(cleanupInterval);
    };
  }, [editingMap]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopEditingAll();
    };
  }, [stopEditingAll]);

  return {
    editingUsers,
    getEditorsForNode,
    startEditing,
    updateEditing,
    stopEditing,
    stopEditingAll,
  };
}

/**
 * Hook for a specific node to track if others are editing it
 */
export function useNodeEditingIndicator(
  editingMap: YMapType<EditingMapValue> | undefined,
  clientId: string | undefined,
  nodeId: string,
  userInfo?: { userId?: string; userName?: string; color?: string },
) {
  const { getEditorsForNode, startEditing, updateEditing, stopEditing } = useEditingPresence(
    editingMap,
    clientId,
    userInfo,
  );

  // Get other users editing this node
  const otherEditors = useMemo(() => getEditorsForNode(nodeId), [getEditorsForNode, nodeId]);

  // Callbacks bound to this node
  const onFocus = useCallback(() => {
    startEditing(nodeId);
  }, [startEditing, nodeId]);

  const onChange = useCallback(() => {
    updateEditing(nodeId);
  }, [updateEditing, nodeId]);

  const onBlur = useCallback(() => {
    stopEditing(nodeId);
  }, [stopEditing, nodeId]);

  return {
    otherEditors,
    onFocus,
    onChange,
    onBlur,
    isBeingEdited: otherEditors.length > 0,
  };
}
