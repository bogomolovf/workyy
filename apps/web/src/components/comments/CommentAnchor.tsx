'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { ThreadSummary } from '../../lib/commentApi';

type Props = {
  thread: ThreadSummary;
  screenX: number;
  screenY: number;
  isActive: boolean;
  isSelected?: boolean;
  zoom: number;
  onClick: (threadId: string) => void;
  /** Called on drag END with the final absolute flow position */
  onMove: (threadId: string, flowX: number, flowY: number) => void;
  /** Called on every drag frame with current absolute flow position (for Yjs sync) */
  onDrag?: (threadId: string, flowX: number, flowY: number) => void;
};

const DRAG_THRESHOLD = 4;

function CommentAnchorInner({
  thread,
  screenX,
  screenY,
  isActive,
  isSelected,
  zoom,
  onClick,
  onMove,
  onDrag,
}: Props) {
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null);
  // Flag: drag ended, waiting for store to update thread.anchorX/Y before clearing offset
  const pendingClearRef = useRef(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    /** Anchor position captured at drag start — immune to polling updates */
    startAnchorX: number;
    startAnchorY: number;
    dragging: boolean;
  } | null>(null);

  // Clear dragOffset only AFTER the store has updated thread position.
  // This prevents the 1-frame flicker back to the old position.
  useEffect(() => {
    if (pendingClearRef.current) {
      pendingClearRef.current = false;
      setDragOffset(null);
    }
  }, [thread.anchorX, thread.anchorY]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      // Capture anchor position at drag start to avoid stale values from polling
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startAnchorX: thread.anchorX,
        startAnchorY: thread.anchorY,
        dragging: false,
      };

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const dx = ev.clientX - dragRef.current.startX;
        const dy = ev.clientY - dragRef.current.startY;
        if (!dragRef.current.dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        dragRef.current.dragging = true;
        setDragOffset({ dx, dy });

        // Sync drag position via Yjs using captured start position
        if (onDrag) {
          const newFlowX = dragRef.current.startAnchorX + dx / zoom;
          const newFlowY = dragRef.current.startAnchorY + dy / zoom;
          onDrag(thread.id, newFlowX, newFlowY);
        }
      };

      const onMouseUp = (ev: MouseEvent) => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        if (!dragRef.current) return;
        const wasDragging = dragRef.current.dragging;
        const dx = ev.clientX - dragRef.current.startX;
        const dy = ev.clientY - dragRef.current.startY;
        const anchorX = dragRef.current.startAnchorX;
        const anchorY = dragRef.current.startAnchorY;
        dragRef.current = null;
        if (wasDragging) {
          // Pass absolute final position (not delta) to avoid stale-anchor issues
          onMove(thread.id, anchorX + dx / zoom, anchorY + dy / zoom);
          // Don't clear dragOffset here — wait for store to update via useEffect
          // to avoid 1-frame flicker back to old position
          pendingClearRef.current = true;
        } else {
          onClick(thread.id);
          setDragOffset(null);
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [thread.id, thread.anchorX, thread.anchorY, zoom, onClick, onMove, onDrag],
  );

  // When drag ended (pendingClear) but useEffect hasn't fired yet,
  // screenX/screenY already reflect the new store position —
  // applying the old dragOffset would cause a 1-frame jump.
  const effectiveOffset = pendingClearRef.current ? null : dragOffset;
  const displayX = screenX + (effectiveOffset?.dx ?? 0);
  const displayY = screenY + (effectiveOffset?.dy ?? 0);

  const cls = [
    'comment-anchor',
    thread.resolved && 'comment-anchor--resolved',
    isActive && 'comment-anchor--active',
    isSelected && 'comment-anchor--selected',
    effectiveOffset && 'comment-anchor--dragging',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={cls}
      style={{ left: displayX, top: displayY, cursor: effectiveOffset ? 'grabbing' : 'grab' }}
      onMouseDown={handleMouseDown}
      title={thread.firstMessage?.body?.slice(0, 80) ?? 'Comment'}
    >
      {thread.resolved ? (
        <svg
          className="comment-anchor__icon"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="3.5 8.5 6.5 11.5 12.5 5.5" />
        </svg>
      ) : (
        <svg className="comment-anchor__icon" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 3a1 1 0 011-1h10a1 1 0 011 1v7a1 1 0 01-1 1H5.5L3 13.5V11H3a1 1 0 01-1-1V3z" />
        </svg>
      )}
      {!thread.resolved && thread.messageCount > 1 && (
        <span className="comment-anchor__badge">{thread.messageCount}</span>
      )}
    </div>
  );
}

export const CommentAnchor = memo(CommentAnchorInner);
