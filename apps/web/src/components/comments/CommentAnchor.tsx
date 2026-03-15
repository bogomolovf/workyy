'use client';

import { memo, useCallback, useRef, useState } from 'react';
import type { ThreadSummary } from '../../lib/commentApi';

type Props = {
  thread: ThreadSummary;
  screenX: number;
  screenY: number;
  isActive: boolean;
  zoom: number;
  onClick: (threadId: string) => void;
  onMove: (threadId: string, deltaFlowX: number, deltaFlowY: number) => void;
};

const DRAG_THRESHOLD = 4;

function CommentAnchorInner({ thread, screenX, screenY, isActive, zoom, onClick, onMove }: Props) {
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    dragging: boolean;
  } | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startY: e.clientY, dragging: false };

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const dx = ev.clientX - dragRef.current.startX;
        const dy = ev.clientY - dragRef.current.startY;
        if (!dragRef.current.dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        dragRef.current.dragging = true;
        setDragOffset({ dx, dy });
      };

      const onMouseUp = (ev: MouseEvent) => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        if (!dragRef.current) return;
        const wasDragging = dragRef.current.dragging;
        const dx = ev.clientX - dragRef.current.startX;
        const dy = ev.clientY - dragRef.current.startY;
        dragRef.current = null;
        if (wasDragging) {
          // Update store FIRST (synchronous), then clear visual offset
          // so React batches both and there's no visual snap-back frame
          onMove(thread.id, dx / zoom, dy / zoom);
        } else {
          onClick(thread.id);
        }
        setDragOffset(null);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [thread.id, zoom, onClick, onMove],
  );

  const displayX = screenX + (dragOffset?.dx ?? 0);
  const displayY = screenY + (dragOffset?.dy ?? 0);

  const cls = [
    'comment-anchor',
    thread.resolved && 'comment-anchor--resolved',
    isActive && 'comment-anchor--active',
    dragOffset && 'comment-anchor--dragging',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={cls}
      style={{ left: displayX, top: displayY, cursor: dragOffset ? 'grabbing' : 'grab' }}
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
