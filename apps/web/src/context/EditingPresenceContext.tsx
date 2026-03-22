'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Map as YMapType } from 'yjs';
import {
  useEditingPresence,
  type EditingUser,
  type EditingMapValue,
} from '../hooks/useEditingPresence';

type EditingPresenceContextValue = {
  editingMap: YMapType<EditingMapValue> | undefined;
  clientId: string | undefined;
  userInfo: { userId?: string; userName?: string; color?: string } | undefined;
  getEditorsForNode: (nodeId: string) => EditingUser[];
  startEditing: (nodeId: string) => void;
  updateEditing: (nodeId: string) => void;
  stopEditing: (nodeId: string) => void;
};

const EditingPresenceContext = createContext<EditingPresenceContextValue | null>(null);

type EditingPresenceProviderProps = {
  editingMap: YMapType<EditingMapValue> | undefined;
  clientId: string | undefined;
  userInfo?: { userId?: string; userName?: string; color?: string };
  children: ReactNode;
};

export function EditingPresenceProvider({
  editingMap,
  clientId,
  userInfo,
  children,
}: EditingPresenceProviderProps) {
  const { getEditorsForNode, startEditing, updateEditing, stopEditing } = useEditingPresence(
    editingMap,
    clientId,
    userInfo,
  );

  const value = useMemo(
    () => ({
      editingMap,
      clientId,
      userInfo,
      getEditorsForNode,
      startEditing,
      updateEditing,
      stopEditing,
    }),
    [editingMap, clientId, userInfo, getEditorsForNode, startEditing, updateEditing, stopEditing],
  );

  return (
    <EditingPresenceContext.Provider value={value}>{children}</EditingPresenceContext.Provider>
  );
}

/**
 * Hook to access editing presence context
 */
export function useEditingPresenceContext() {
  const context = useContext(EditingPresenceContext);
  if (!context) {
    // Return a no-op version if context is not available
    // This allows components to work outside of the provider
    return {
      editingMap: undefined,
      clientId: undefined,
      userInfo: undefined,
      getEditorsForNode: () => [],
      startEditing: () => {},
      updateEditing: () => {},
      stopEditing: () => {},
    };
  }
  return context;
}

/**
 * Hook for a specific node to track editing and show indicator
 */
export function useNodeEditing(nodeId: string) {
  const { getEditorsForNode, startEditing, updateEditing, stopEditing } =
    useEditingPresenceContext();

  const otherEditors = useMemo(() => getEditorsForNode(nodeId), [getEditorsForNode, nodeId]);

  return {
    otherEditors,
    isBeingEdited: otherEditors.length > 0,
    onFocus: () => startEditing(nodeId),
    onChange: () => updateEditing(nodeId),
    onBlur: () => stopEditing(nodeId),
  };
}
