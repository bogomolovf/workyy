'use client';

import { useEffect, useCallback, useMemo, useState, memo } from 'react';
import { useViewport } from 'reactflow';
import { useAuthStore } from '../../state/authStore';
import { useCommentStore } from '../../state/commentStore';
import { CommentAnchor } from './CommentAnchor';
import { CommentComposer } from './CommentComposer';
import { CommentThreadCard } from './CommentThreadCard';

type Props = {
  boardId: string;
};

/**
 * Converts flow coordinates to screen (pixel) coordinates using the current
 * ReactFlow viewport. The viewport provides { x: panX, y: panY, zoom }.
 *
 * screenX = flowX * zoom + panX
 * screenY = flowY * zoom + panY
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

function CommentLayerInner({ boardId }: Props) {
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
    // If there's unsaved text, ask before discarding
    if (composerText.trim()) {
      // Keep draft in store but close UI
      cancelComposer();
    } else {
      cancelComposer();
    }
  }, [composerText, cancelComposer]);

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

  const handleAnchorMove = useCallback(
    (threadId: string, deltaFlowX: number, deltaFlowY: number) => {
      const t = threads[threadId];
      if (!t) return;
      moveThreadAnchor(boardId, threadId, t.anchorX + deltaFlowX, t.anchorY + deltaFlowY);
    },
    [boardId, threads, moveThreadAnchor],
  );

  const handleCloseThread = useCallback(() => {
    closeThread();
  }, [closeThread]);

  const threadList = useMemo(() => Object.values(threads), [threads]);

  if (!user) return null;

  return (
    <div className="comment-layer">
      {/* Render all comment anchors */}
      {threadList.map((thread) => {
        const pos = flowToScreen(thread.anchorX, thread.anchorY, viewport);
        return (
          <CommentAnchor
            key={thread.id}
            thread={thread}
            screenX={pos.x}
            screenY={pos.y}
            isActive={activeThreadId === thread.id}
            zoom={viewport.zoom}
            onClick={handleAnchorClick}
            onMove={handleAnchorMove}
          />
        );
      })}

      {/* Active thread card */}
      {activeThreadId &&
        activeThread &&
        threads[activeThreadId] &&
        (() => {
          const t = threads[activeThreadId];
          const pos = flowToScreen(t.anchorX, t.anchorY, viewport);
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
      {composerAnchor && (
        <>
          {/* Composer anchor pin */}
          <div
            className="comment-anchor comment-anchor--active"
            style={{
              left: flowToScreen(composerAnchor.x, composerAnchor.y, viewport).x,
              top: flowToScreen(composerAnchor.x, composerAnchor.y, viewport).y,
            }}
          >
            <svg className="comment-anchor__icon" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 2a6 6 0 016 6 6 6 0 01-6 6 6 6 0 01-6-6 6 6 0 016-6zm0 2.5v3h-3v1h3v3h1v-3h3v-1h-3v-3h-1z" />
            </svg>
          </div>

          {/* Anchor line */}
          {(() => {
            const anchorPos = flowToScreen(composerAnchor.x, composerAnchor.y, viewport);
            const cardLeft = anchorPos.x + 20;
            const cardTop = anchorPos.y - 8;
            return (
              <svg className="comment-anchor-line">
                <line
                  x1={anchorPos.x}
                  y1={anchorPos.y}
                  x2={cardLeft}
                  y2={cardTop + 18}
                  stroke="#4f46e5"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                  opacity="0.4"
                />
              </svg>
            );
          })()}

          {/* Composer card */}
          {(() => {
            const anchorPos = flowToScreen(composerAnchor.x, composerAnchor.y, viewport);
            let cardLeft = anchorPos.x + 20;
            let cardTop = anchorPos.y - 8;
            if (typeof window !== 'undefined') {
              if (cardLeft > window.innerWidth - 340) cardLeft = anchorPos.x - 340;
              if (cardLeft < 8) cardLeft = 8;
              if (cardTop < 8) cardTop = 8;
            }
            return (
              <div
                className="comment-card"
                style={{ left: cardLeft, top: cardTop, maxHeight: 'auto' }}
                onClick={(e) => e.stopPropagation()}
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
            );
          })()}
        </>
      )}
    </div>
  );
}

export const CommentLayer = memo(CommentLayerInner);
