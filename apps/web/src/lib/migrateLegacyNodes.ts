/**
 * Migrates legacy node types to new cell-based types.
 *
 * - python node -> standalone pythonCell
 * - sql node -> sqlCell
 * - notebook node -> chain of pythonCell/markdownCell (no frame)
 *
 * Run on board load before rendering.
 */

import { useChainStore } from '../state/chainStore';

type CanvasNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  payload?: Record<string, unknown>;
};

const CELL_STACK_GAP = 0;
const DEFAULT_CELL_HEIGHT = 180;
const DEFAULT_MD_CELL_HEIGHT = 100;
const NOTEBOOK_HEADER_HEIGHT = 28;

let migrationIdCounter = 0;

function createMigrationId(): string {
  migrationIdCounter++;
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `migrated-${Date.now().toString(36)}-${migrationIdCounter}`;
}

export type MigrationResult = {
  nodes: CanvasNode[];
  changed: boolean;
};

export function migrateLegacyNodes(nodes: CanvasNode[]): MigrationResult {
  let changed = false;
  const result: CanvasNode[] = [];

  for (const node of nodes) {
    if (node.type === 'python') {
      changed = true;
      const payload = (node.payload ?? {}) as Record<string, unknown>;
      result.push({
        ...node,
        type: 'pythonCell',
        payload: {
          cellSource: (payload.python as string) ?? '',
          cellLanguage: 'python',
          execution: payload.execution,
        },
      });
    } else if (node.type === 'sql') {
      changed = true;
      const payload = (node.payload ?? {}) as Record<string, unknown>;
      result.push({
        ...node,
        type: 'sqlCell',
        payload: {
          cellSource: (payload.sql as string) ?? 'SELECT 1;',
          cellLanguage: 'sql',
          execution: payload.execution,
        },
      });
    } else if (node.type === 'notebook') {
      // Keep notebook nodes as-is — they are single unified nodes
      result.push(node);
    } else if (node.type === 'notebookFrame') {
      // Skip legacy frame nodes
      changed = true;
    } else {
      result.push(node);
    }
  }

  return { nodes: result, changed };
}
