'use client';

import { useState, useCallback, useRef, useEffect, memo } from 'react';
import type { ThreadDetail } from '../../lib/commentApi';
import { useCommentStore } from '../../state/commentStore';
import { CommentComposer } from './CommentComposer';
import { CommentMessageItem } from './CommentMessageItem';

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

  // Viewport-aware positioning
  const CARD_OFFSET_X = 20;
  const CARD_OFFSET_Y = -8;
  let cardLeft = screenX + CARD_OFFSET_X;
  let cardTop = screenY + CARD_OFFSET_Y;

  if (typeof window !== 'undefined') {
    const maxLeft = window.innerWidth - 340;
    const maxTop = window.innerHeight - 500;
    if (cardLeft > maxLeft) cardLeft = screenX - 340;
    if (cardTop > maxTop) cardTop = Math.max(8, maxTop);
    if (cardTop < 8) cardTop = 8;
    if (cardLeft < 8) cardLeft = 8;
  }

  return (
    <div
      className="comment-card"
      style={{ left: cardLeft, top: cardTop }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header — only resolve + close */}
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
            isThreadCreator={thread.createdById === currentUserId}
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
  );
}

export const CommentThreadCard = memo(CommentThreadCardInner);
