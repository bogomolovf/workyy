import { useCallback, useEffect, useRef, useState } from 'react';
import { UndoManager } from 'yjs';
import type { Map as YMap, Doc, AbstractType } from 'yjs';
import { undoState } from '../lib/yjs/undoState';

/**
 * Hook for per-user undo/redo using Yjs UndoManager
 *
 * Key features:
 * - Only tracks changes made by the current user (via trackedOrigins)
 * - Changes from other users are NOT undone/redone by this user
 * - Deletions and additions sync across all users normally through Yjs
 * - Each user has their own undo/redo stack
 *
 * IMPORTANT: UndoManager tracks ALL changes by default (when trackedOrigins is empty or contains null).
 * We track changes with clientId OR null origin to capture all local changes.
 */
export function useYjsUndoManager(
  ydoc: Doc | null,
  nodesMap: YMap<unknown> | null,
  edgesMap: YMap<unknown> | null,
  clientId: string | null,
) {
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [undoStackLength, setUndoStackLength] = useState(0);
  const [redoStackLength, setRedoStackLength] = useState(0);

  // Store UndoManager in ref to avoid recreation issues with React Strict Mode
  const undoManagerRef = useRef<UndoManager | null>(null);
  const initKeyRef = useRef<string | null>(null);

  // Create UndoManager that tracks only this user's changes
  // Use a stable key based on inputs to detect when we need to recreate
  const currentKey =
    ydoc && nodesMap && edgesMap && clientId ? `${ydoc.clientID}-${clientId}` : null;

  // Create or get UndoManager
  if (currentKey && currentKey !== initKeyRef.current) {
    // Clean up old manager if it exists
    if (undoManagerRef.current) {
      undoManagerRef.current.destroy();
    }

    // Create UndoManager for both nodes and edges maps
    // CRITICAL: trackedOrigins determines which transactions are tracked
    // - clientId: tracks ONLY transactions made with clientId as origin
    // - We DON'T include null to avoid tracking changes during undo/redo
    // - We don't add ydoc.clientID as it's used for WebSocket sync origins
    const trackedSet = new Set<string>([clientId]);

    const manager = new UndoManager(
      [nodesMap as AbstractType<unknown>, edgesMap as AbstractType<unknown>],
      {
        trackedOrigins: trackedSet,
        // Capture timeout - group rapid changes together (300ms)
        captureTimeout: 300,
      },
    );

    undoManagerRef.current = manager;
    initKeyRef.current = currentKey;
  } else if (!currentKey && undoManagerRef.current) {
    // Clean up if inputs become null
    undoManagerRef.current.destroy();
    undoManagerRef.current = null;
    initKeyRef.current = null;
  }

  const undoManager = undoManagerRef.current;

  // Update canUndo/canRedo state when stack changes
  useEffect(() => {
    if (!undoManager) {
      setCanUndo(false);
      setCanRedo(false);
      return;
    }

    const updateState = () => {
      setCanUndo(undoManager.canUndo());
      setCanRedo(undoManager.canRedo());
      setUndoStackLength(undoManager.undoStack.length);
      setRedoStackLength(undoManager.redoStack.length);
    };

    const onStackItemAdded = (event: { stackItem: { meta: Map<string, unknown> } }) => {
      if (!event.stackItem.meta.has('timestamp')) {
        event.stackItem.meta.set('timestamp', Date.now());
      }
      updateState();
    };

    undoManager.on('stack-item-added', onStackItemAdded);
    undoManager.on('stack-item-popped', updateState);
    undoManager.on('stack-cleared', updateState);

    // Initial state
    updateState();

    return () => {
      undoManager.off('stack-item-added', onStackItemAdded);
      undoManager.off('stack-item-popped', updateState);
      undoManager.off('stack-cleared', updateState);
    };
  }, [undoManager]);

  // Undo - only undoes this user's changes
  const undo = useCallback(() => {
    if (!undoManager || !undoManager.canUndo()) {
      return;
    }
    // Set global flag to prevent onNodesChanges from creating new transactions during undo
    undoState.isUndoing = true;
    undoManager.undo();
    // Reset flag after a short delay to allow React to re-render
    setTimeout(() => {
      undoState.isUndoing = false;
    }, 100);
  }, [undoManager]);

  // Redo - only redoes this user's changes
  const redo = useCallback(() => {
    if (!undoManager || !undoManager.canRedo()) {
      return;
    }
    // Set global flag to prevent onNodesChanges from creating new transactions during redo
    undoState.isUndoing = true;
    undoManager.redo();
    // Reset flag after a short delay to allow React to re-render
    setTimeout(() => {
      undoState.isUndoing = false;
    }, 100);
  }, [undoManager]);

  // Stop capturing - call when you want to break the capture timeout
  // This creates a new undo group
  const stopCapturing = useCallback(() => {
    if (undoManager) {
      undoManager.stopCapturing();
    }
  }, [undoManager]);

  // Clear all undo/redo history
  const clear = useCallback(() => {
    if (undoManager) {
      undoManager.clear();
    }
  }, [undoManager]);

  // Destroy UndoManager on unmount
  useEffect(() => {
    return () => {
      if (undoManagerRef.current) {
        undoManagerRef.current.destroy();
        undoManagerRef.current = null;
        initKeyRef.current = null;
      }
    };
  }, []);

  return {
    undo,
    redo,
    stopCapturing,
    clear,
    canUndo,
    canRedo,
    undoManager,
    undoStackLength,
    redoStackLength,
  };
}

/**
 * Hook wrapper that provides origin for Yjs transactions
 * Use this when making changes to ensure they are tracked by UndoManager
 */
export function useYjsTransactionOrigin(ydoc: Doc | null, clientId: string | null) {
  // Wrap changes in a transaction with origin to enable undo tracking
  const transact = useCallback(
    (fn: () => void) => {
      if (!ydoc || !clientId) {
        fn();
        return;
      }

      // Transaction with clientId as origin ensures UndoManager tracks this change
      ydoc.transact(fn, clientId);
    },
    [ydoc, clientId],
  );

  return { transact };
}
