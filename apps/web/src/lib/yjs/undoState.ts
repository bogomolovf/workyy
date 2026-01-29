/**
 * Global state for tracking undo/redo operations
 * Used to prevent double-tracking when undo/redo causes onNodesChanges callbacks
 */

// Simple singleton to track if undo/redo is in progress
export const undoState = {
  isUndoing: false,
};
