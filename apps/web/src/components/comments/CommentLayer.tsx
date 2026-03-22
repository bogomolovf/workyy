'use client';

import { useEffect, useCallback, useMemo, useState, memo, useRef } from 'react';
import { useViewport } from 'reactflow';
import type { Map as YMapType } from 'yjs';
import { useAuthStore } from '../../state/authStore';
import { useCommentStore } from '../../state/commentStore';
import { CommentAnchor } from './CommentAnchor';
import { CommentComposer } from './CommentComposer';
import { CommentThreadCard } from './CommentThreadCard';

type Props = {
  boardId: string;
  selectedCommentIds?: Set<string>;
  /** Yjs map for real-time comment drag position sync */
  commentDragMap?: YMapType<unknown> | null;
  /** Yjs map for cursor positions (to update cursor during comment drag) */
  cursorsMap?: YMapType<unknown> | null;
  /** Local Yjs client ID — used to filter out own drag entries */
  clientId?: string;
};

/**
 * Converts flow coordinates to pixel coordinates relative to the canvas container.
 * viewport provides { x: panX, y: panY, zoom }.
 */
function flowToScreen(
  flowX: number,
  flowY: number,
  viewport: { x: number; y: number; zoom: number },
) {
  return {
    x: flowX * viewport.zoom + viewport.x,
    y: flowY * viewport.zoom + viewport.y,
  };
}

function CommentLayerInner({ boardId, selectedCommentIds, commentDragMap, cursorsMap, clientId: localClientId }: Props) {
  const viewport = useViewport();
  const user = useAuthStore((s) => s.user);
  const {
    threads,
    activeThreadId,
    activeThread,
    composerAnchor,
    submitting,
    loadThreads,
    startPolling,
    stopPolling,
    openThread,
    closeThread,
    cancelComposer,
    submitThread,
    setDraft,
    getDraft,
    moveThreadAnchor,
  } = useCommentStore();

  const [composerText, setComposerText] = useState('');
  const layerRef = useRef<HTMLDivElement>(null);

  // Real-time drag positions from other users (via Yjs).
  // `activeDrags` — entries currently in the Yjs map (actively being dragged).
  // `settledDrags` — last known position after drag ended (Yjs entry deleted)
  //   kept until thread.anchorX/Y catches up from the server to avoid flicker.
  const [activeDrags, setActiveDrags] = useState<
    Map<string, { x: number; y: number }>
  >(new Map());
  const settledDragsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const [settledDragsTick, setSettledDragsTick] = useState(0);

  // Observe commentDragMap for real-time drag sync from OTHER users only.
  // Own drags are rendered via local dragOffset in CommentAnchor.
  useEffect(() => {
    if (!commentDragMap) return;
    const observer = () => {
      const positions = new Map<string, { x: number; y: number }>();
      for (const [key, value] of commentDragMap.entries()) {
        const v = value as { x: number; y: number; clientId?: string } | undefined;
        if (!v || typeof v.x !== 'number' || typeof v.y !== 'number') continue;
        // Skip own drag entries — local user sees the drag via CSS offset
        if (v.clientId && v.clientId === localClientId) continue;
        positions.set(key, v);
      }

      // Detect entries that were removed (drag ended) — preserve their last position
      setActiveDrags((prev) => {
        let settledChanged = false;
        for (const [id, pos] of prev) {
          if (!positions.has(id)) {
            // Drag ended — keep last position until store catches up
            settledDragsRef.current.set(id, pos);
            settledChanged = true;
          }
        }
        if (settledChanged) {
          setSettledDragsTick((t) => t + 1);
        }
        return positions;
      });
    };
    observer(); // initial
    commentDragMap.observe(observer);
    return () => commentDragMap.unobserve(observer);
  }, [commentDragMap, localClientId]);

  // Clear settled drag positions once thread.anchorX/Y catches up from the server
  useEffect(() => {
    if (settledDragsRef.current.size === 0) return;
    for (const [threadId, pos] of settledDragsRef.current) {
      const thread = threads[threadId];
      if (!thread) {
        settledDragsRef.current.delete(threadId);
        continue;
      }
      // If the store position is close to the settled drag position, clear it
      const dx = Math.abs(thread.anchorX - pos.x);
      const dy = Math.abs(thread.anchorY - pos.y);
      if (dx < 1 && dy < 1) {
        settledDragsRef.current.delete(threadId);
      }
    }
  }, [threads, settledDragsTick]);

  // Load threads and start polling on mount
  useEffect(() => {
    loadThreads(boardId);
    startPolling(boardId);
    return () => stopPolling();
  }, [boardId, loadThreads, startPolling, stopPolling]);

  // Sync composer text with draft store
  useEffect(() => {
    setComposerText(getDraft('composer'));
  }, [composerAnchor, getDraft]);

  // Global Escape handler to close composer / active thread
  useEffect(() => {
    if (!composerAnchor && !activeThreadId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (composerAnchor) cancelComposer();
        else if (activeThreadId) closeThread();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [composerAnchor, activeThreadId, cancelComposer, closeThread]);

  const handleComposerChange = useCallback(
    (text: string) => {
      setComposerText(text);
      setDraft('composer', text);
    },
    [setDraft],
  );

  const handleComposerSubmit = useCallback(() => {
    if (!composerText.trim()) return;
    submitThread(boardId, composerText.trim());
    setComposerText('');
  }, [composerText, boardId, submitThread]);

  const handleComposerCancel = useCallback(() => {
    cancelComposer();
    setComposerText('');
  }, [cancelComposer]);

  const handleAnchorClick = useCallback(
    (threadId: string) => {
      if (activeThreadId === threadId) {
        closeThread();
      } else {
        openThread(threadId);
      }
    },
    [activeThreadId, openThread, closeThread],
  );

  // Called during drag (every mouse move) — sync comment position + cursor via Yjs
  const handleAnchorDrag = useCallback(
    (threadId: string, flowX: number, flowY: number) => {
      if (commentDragMap) {
        commentDragMap.set(threadId, { x: flowX, y: flowY, clientId: localClientId });
      }
      // Place cursor at the comment's flow position so other users see
      // the cursor move together with the comment being dragged.
      if (cursorsMap && localClientId) {
        const existing = cursorsMap.get(localClientId) as Record<string, unknown> | undefined;
        if (existing) {
          cursorsMap.set(localClientId, {
            ...existing,
            x: flowX,
            y: flowY,
            timestamp: Date.now(),
          });
        }
      }
    },
    [commentDragMap, cursorsMap, localClientId],
  );

  // Called on drag end — persist final ABSOLUTE position and clear Yjs drag entry
  const handleAnchorMove = useCallback(
    (threadId: string, flowX: number, flowY: number) => {
      moveThreadAnchor(boardId, threadId, flowX, flowY);
      if (commentDragMap) {
        commentDragMap.delete(threadId);
      }
    },
    [boardId, moveThreadAnchor, commentDragMap],
  );

  const handleCloseThread = useCallback(() => {
    closeThread();
  }, [closeThread]);

  const threadList = useMemo(() => Object.values(threads), [threads]);

  if (!user) return null;

  return (
    <div ref={layerRef} className="comment-layer">
      {/* Render all comment anchors */}
      {threadList.map((thread) => {
        // Use Yjs drag position if another user is dragging this comment,
        // or the settled position if drag just ended but store hasn't caught up yet
        const dragPos = activeDrags.get(thread.id) ?? settledDragsRef.current.get(thread.id);
        const anchorX = dragPos ? dragPos.x : thread.anchorX;
        const anchorY = dragPos ? dragPos.y : thread.anchorY;
        const pos = flowToScreen(anchorX, anchorY, viewport);
        return (
          <CommentAnchor
            key={thread.id}
            thread={thread}
            screenX={pos.x}
            screenY={pos.y}
            isActive={activeThreadId === thread.id}
            isSelected={selectedCommentIds?.has(thread.id) ?? false}
            zoom={viewport.zoom}
            onClick={handleAnchorClick}
            onMove={handleAnchorMove}
            onDrag={handleAnchorDrag}
          />
        );
      })}

      {/* Active thread card */}
      {activeThreadId &&
        activeThread &&
        threads[activeThreadId] &&
        (() => {
          const t = threads[activeThreadId];
          const dragPos = activeDrags.get(activeThreadId) ?? settledDragsRef.current.get(activeThreadId);
          const anchorX = dragPos ? dragPos.x : t.anchorX;
          const anchorY = dragPos ? dragPos.y : t.anchorY;
          const pos = flowToScreen(anchorX, anchorY, viewport);
          return (
            <CommentThreadCard
              thread={activeThread}
              boardId={boardId}
              currentUserId={user.id}
              screenX={pos.x}
              screenY={pos.y}
              onClose={handleCloseThread}
            />
          );
        })()}

      {/* New comment composer */}
      {composerAnchor &&
        (() => {
          const anchorPos = flowToScreen(composerAnchor.x, composerAnchor.y, viewport);
          let cardLeft = anchorPos.x + 24;
          let cardTop = anchorPos.y - 8;
          if (typeof window !== 'undefined') {
            if (cardLeft > window.innerWidth - 340) cardLeft = anchorPos.x - 340;
            if (cardLeft < 8) cardLeft = 8;
            if (cardTop < 8) cardTop = 8;
            if (cardTop > window.innerHeight - 200) cardTop = window.innerHeight - 200;
          }
          return (
            <>
              {/* Composer anchor pin */}
              <div
                className="comment-anchor comment-anchor--active"
                style={{ left: anchorPos.x, top: anchorPos.y }}
              >
                <svg className="comment-anchor__icon" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 2a6 6 0 016 6 6 6 0 01-6 6 6 6 0 01-6-6 6 6 0 016-6zm0 2.5v3h-3v1h3v3h1v-3h3v-1h-3v-3h-1z" />
                </svg>
              </div>

              {/* Composer card */}
              <div
                className="comment-card"
                style={{ left: cardLeft, top: cardTop }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="comment-card__header">
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>
                    New comment
                  </span>
                  <button
                    className="comment-icon-btn"
                    onClick={handleComposerCancel}
                    title="Cancel (Esc)"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <line x1="4" y1="4" x2="12" y2="12" />
                      <line x1="12" y1="4" x2="4" y2="12" />
                    </svg>
                  </button>
                </div>
                <CommentComposer
                  value={composerText}
                  onChange={handleComposerChange}
                  onSubmit={handleComposerSubmit}
                  onCancel={handleComposerCancel}
                  submitting={submitting}
                />
              </div>
            </>
          );
        })()}
    </div>
  );
}

export const CommentLayer = memo(CommentLayerInner);
