'use client';

import { useState, useCallback, useRef, useEffect, memo } from 'react';
import type { ThreadDetail } from '../../lib/commentApi';
import { CommentMessageItem } from './CommentMessageItem';
import { CommentComposer } from './CommentComposer';
import { CommentActionsMenu, type ActionItem } from './CommentActionsMenu';
import { useCommentStore } from '../../state/commentStore';

type Props = {
  thread: ThreadDetail;
  boardId: string;
  currentUserId: string;
  screenX: number;
  screenY: number;
  onClose: () => void;
};

function CommentThreadCardInner({
  thread,
  boardId,
  currentUserId,
  screenX,
  screenY,
  onClose,
}: Props) {
  const store = useCommentStore();
  const [showMenu, setShowMenu] = useState(false);
  const [replyText, setReplyText] = useState(store.getDraft(thread.id));
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Persist draft
  useEffect(() => {
    store.setDraft(thread.id, replyText);
  }, [replyText, thread.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread.messages.length]);

  const handleReply = useCallback(() => {
    if (!replyText.trim()) return;
    store.submitReply(boardId, thread.id, replyText.trim());
    setReplyText('');
  }, [replyText, boardId, thread.id, store]);

  const handleResolve = useCallback(() => {
    store.resolveThread(boardId, thread.id, !thread.resolved);
  }, [boardId, thread.id, thread.resolved, store]);

  const handleSubscribe = useCallback(() => {
    store.toggleSubscription(boardId, thread.id, !thread.subscribed);
  }, [boardId, thread.id, thread.subscribed, store]);

  const handleDelete = useCallback(() => {
    store.deleteThread(boardId, thread.id);
    onClose();
  }, [boardId, thread.id, store, onClose]);

  const handleToggleReaction = useCallback(
    (messageId: string, emoji: string) => {
      store.toggleReaction(boardId, thread.id, messageId, emoji, currentUserId);
    },
    [boardId, thread.id, currentUserId, store],
  );

  const handleEditMessage = useCallback(
    (messageId: string, body: string) => {
      store.editMessage(boardId, thread.id, messageId, body);
    },
    [boardId, thread.id, store],
  );

  const handleDeleteMessage = useCallback(
    (messageId: string) => {
      store.deleteMessage(boardId, thread.id, messageId);
    },
    [boardId, thread.id, store],
  );

  const menuItems: ActionItem[] = [
    {
      label: thread.resolved ? 'Reopen' : 'Resolve',
      icon: thread.resolved ? '🔓' : '✅',
      onClick: handleResolve,
    },
    {
      label: thread.subscribed ? 'Unsubscribe' : 'Subscribe',
      icon: thread.subscribed ? '🔕' : '🔔',
      onClick: handleSubscribe,
    },
  ];
  const isCreator = thread.createdById === currentUserId;
  if (isCreator) {
    menuItems.push({
      label: 'Delete thread',
      icon: '🗑️',
      danger: true,
      onClick: handleDelete,
    });
  }

  // Viewport-aware positioning: offset the card from the anchor
  // Card appears to the right and slightly above the anchor
  const CARD_OFFSET_X = 20;
  const CARD_OFFSET_Y = -8;
  let cardLeft = screenX + CARD_OFFSET_X;
  let cardTop = screenY + CARD_OFFSET_Y;

  // Prevent overflow beyond viewport
  if (typeof window !== 'undefined') {
    const maxLeft = window.innerWidth - 340;
    const maxTop = window.innerHeight - 500;
    if (cardLeft > maxLeft) cardLeft = screenX - 340;
    if (cardTop > maxTop) cardTop = Math.max(8, maxTop);
    if (cardTop < 8) cardTop = 8;
    if (cardLeft < 8) cardLeft = 8;
  }

  return (
    <>
      {/* Anchor line from pin to card */}
      <svg className="comment-anchor-line">
        <line
          x1={screenX}
          y1={screenY}
          x2={cardLeft}
          y2={cardTop + 18}
          stroke="#4f46e5"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          opacity="0.4"
        />
      </svg>

      {/* onClick stops pane-click from closing the thread; onMouseDown is NOT
         stopped so ReactFlow nodes underneath can still receive drag events. */}
      <div
        className="comment-card"
        style={{ left: cardLeft, top: cardTop }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="comment-card__header">
          <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>
            {thread.messages.length} {thread.messages.length === 1 ? 'comment' : 'comments'}
          </span>
          <div className="comment-card__header-actions">
            <button
              className={`comment-icon-btn${thread.resolved ? ' comment-icon-btn--active' : ''}`}
              onClick={handleResolve}
              title={thread.resolved ? 'Reopen' : 'Resolve'}
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
                <polyline points="3.5 8.5 6.5 11.5 12.5 5.5" />
              </svg>
            </button>
            <button
              className={`comment-icon-btn${thread.subscribed ? ' comment-icon-btn--active' : ''}`}
              onClick={handleSubscribe}
              title={thread.subscribed ? 'Unsubscribe' : 'Subscribe'}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M8 2a4 4 0 014 4v3l1.5 2H2.5L4 9V6a4 4 0 014-4z" />
                <path d="M6.5 13a1.5 1.5 0 003 0" />
              </svg>
            </button>
            <div style={{ position: 'relative' }}>
              <button
                className="comment-icon-btn"
                onClick={() => setShowMenu((v) => !v)}
                title="More actions"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <circle cx="3" cy="8" r="1.5" />
                  <circle cx="8" cy="8" r="1.5" />
                  <circle cx="13" cy="8" r="1.5" />
                </svg>
              </button>
              {showMenu && (
                <CommentActionsMenu items={menuItems} onClose={() => setShowMenu(false)} />
              )}
            </div>
            <button className="comment-icon-btn" onClick={onClose} title="Close">
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
        </div>

        {/* Resolved banner */}
        {thread.resolved && (
          <div className="comment-card__resolved-banner">
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="3.5 8.5 6.5 11.5 12.5 5.5" />
            </svg>
            Resolved{thread.resolvedBy ? ` by ${thread.resolvedBy.name ?? 'user'}` : ''}
          </div>
        )}

        {/* Messages list */}
        <div className="comment-card__messages">
          {thread.messages.map((msg) => (
            <CommentMessageItem
              key={msg.id}
              message={msg}
              currentUserId={currentUserId}
              boardId={boardId}
              threadId={thread.id}
              isThreadCreator={isCreator}
              onToggleReaction={handleToggleReaction}
              onEdit={handleEditMessage}
              onDelete={handleDeleteMessage}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply composer */}
        <CommentComposer
          value={replyText}
          onChange={setReplyText}
          onSubmit={handleReply}
          onCancel={onClose}
          placeholder="Reply\u2026"
          submitting={store.submitting}
          autoFocus={false}
        />
      </div>
    </>
  );
}

export const CommentThreadCard = memo(CommentThreadCardInner);
