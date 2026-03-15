/**
 * Auto-positioning logic for cells within a NotebookFrame.
 *
 * Cells inside a frame are positioned relative to the frame's top-left corner.
 * They stack vertically with a small gap between them.
 */

export const CELL_GAP = 4;
export const FRAME_PADDING_X = 12;
export const FRAME_PADDING_TOP = 36; // space for compact frame header
export const FRAME_PADDING_BOTTOM = 12;
export const DEFAULT_CELL_WIDTH = 496; // 520 frame - 2*12 padding
export const DEFAULT_PYTHON_CELL_HEIGHT = 180;
export const DEFAULT_MARKDOWN_CELL_HEIGHT = 100;
export const DEFAULT_SQL_CELL_HEIGHT = 180;

type CellInfo = {
  id: string;
  type: 'pythonCell' | 'markdownCell' | 'sqlCell';
  height?: number;
};

type LayoutResult = {
  positions: Record<string, { x: number; y: number }>;
  frameWidth: number;
  frameHeight: number;
};

function getDefaultHeight(type: CellInfo['type']): number {
  switch (type) {
    case 'pythonCell':
      return DEFAULT_PYTHON_CELL_HEIGHT;
    case 'markdownCell':
      return DEFAULT_MARKDOWN_CELL_HEIGHT;
    case 'sqlCell':
      return DEFAULT_SQL_CELL_HEIGHT;
    default:
      return DEFAULT_PYTHON_CELL_HEIGHT;
  }
}

/**
 * Calculates vertical positions for all cells within a frame.
 * Returns positions relative to the frame's top-left corner.
 */
export function layoutCellsInFrame(cells: CellInfo[], frameWidth?: number): LayoutResult {
  const width = frameWidth ?? DEFAULT_CELL_WIDTH + 2 * FRAME_PADDING_X;
  const cellWidth = width - 2 * FRAME_PADDING_X;
  const positions: Record<string, { x: number; y: number }> = {};

  let currentY = FRAME_PADDING_TOP;

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    positions[cell.id] = {
      x: FRAME_PADDING_X,
      y: currentY,
    };
    const cellHeight = cell.height ?? getDefaultHeight(cell.type);
    currentY += cellHeight + CELL_GAP;
  }

  const frameHeight = currentY - CELL_GAP + FRAME_PADDING_BOTTOM;

  return {
    positions,
    frameWidth: width,
    frameHeight: Math.max(frameHeight, 120),
  };
}

/**
 * Determines cell position label for border-radius styling.
 */
export function getCellPosition(
  index: number,
  total: number,
): 'only' | 'first' | 'middle' | 'last' {
  if (total <= 1) return 'only';
  if (index === 0) return 'first';
  if (index === total - 1) return 'last';
  return 'middle';
}

/**
 * Calculates the frame size needed to contain the given cells.
 */
export function calculateFrameSize(
  cells: CellInfo[],
  frameWidth?: number,
): { width: number; height: number } {
  const layout = layoutCellsInFrame(cells, frameWidth);
  return { width: layout.frameWidth, height: layout.frameHeight };
}

/**
 * Check if a position is near a frame (for drag-to-join detection).
 * Returns true if the point is within `threshold` pixels of the frame bounds.
 */
export function isNearFrame(
  point: { x: number; y: number },
  frameBounds: { x: number; y: number; width: number; height: number },
  threshold = 40,
): boolean {
  const expandedBounds = {
    left: frameBounds.x - threshold,
    top: frameBounds.y - threshold,
    right: frameBounds.x + frameBounds.width + threshold,
    bottom: frameBounds.y + frameBounds.height + threshold,
  };
  return (
    point.x >= expandedBounds.left &&
    point.x <= expandedBounds.right &&
    point.y >= expandedBounds.top &&
    point.y <= expandedBounds.bottom
  );
}

/**
 * Given a Y position within a frame, determine the insert index.
 */
export function getInsertIndex(yInFrame: number, cells: CellInfo[]): number {
  const layout = layoutCellsInFrame(cells);
  let bestIndex = cells.length;

  for (let i = 0; i < cells.length; i++) {
    const cellPos = layout.positions[cells[i].id];
    if (!cellPos) continue;
    const cellHeight = cells[i].height ?? getDefaultHeight(cells[i].type);
    const cellMidY = cellPos.y + cellHeight / 2;
    if (yInFrame < cellMidY) {
      bestIndex = i;
      break;
    }
  }

  return bestIndex;
}
