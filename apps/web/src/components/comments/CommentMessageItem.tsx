'use client';

import { useState, useCallback, useRef, memo } from 'react';
import type { CommentMessageData } from '../../lib/commentApi';
import { MessageReactions } from './MessageReactions';
import { CommentEmojiPicker } from './CommentEmojiPicker';
import { CommentActionsMenu, type ActionItem } from './CommentActionsMenu';

type Props = {
  message: CommentMessageData;
  currentUserId: string;
  boardId: string;
  threadId: string;
  isThreadCreator: boolean;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onEdit: (messageId: string, body: string) => void;
  onDelete: (messageId: string) => void;
};

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function CommentMessageItemInner({
  message,
  currentUserId,
  onToggleReaction,
  onEdit,
  onDelete,
}: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiTriggerRef = useRef<HTMLButtonElement>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.body);

  const isOwn = message.authorId === currentUserId;

  const handleReaction = useCallback(
    (emoji: string) => onToggleReaction(message.id, emoji),
    [message.id, onToggleReaction],
  );

  const handleSaveEdit = useCallback(() => {
    if (editText.trim() && editText.trim() !== message.body) {
      onEdit(message.id, editText.trim());
    }
    setEditing(false);
  }, [editText, message.id, message.body, onEdit]);

  const menuItems: ActionItem[] = [];
  if (isOwn && !message.deleted) {
    menuItems.push({
      label: 'Edit',
      icon: '✏️',
      onClick: () => {
        setEditing(true);
        setEditText(message.body);
      },
    });
    menuItems.push({
      label: 'Delete',
      icon: '🗑️',
      danger: true,
      onClick: () => onDelete(message.id),
    });
  }

  if (message.deleted) {
    return (
      <div className="comment-msg">
        <div className="comment-msg__header">
          <div className="comment-msg__avatar">
            {getInitials(message.author.name, message.author.email)}
          </div>
          <span className="comment-msg__author">{message.author.name ?? message.author.email}</span>
          <span className="comment-msg__time">{timeAgo(message.createdAt)}</span>
        </div>
        <p className="comment-msg__body comment-msg__body--deleted">This message was deleted</p>
      </div>
    );
  }

  return (
    <div className="comment-msg">
      <div className="comment-msg__header">
        <div className="comment-msg__avatar">
          {getInitials(message.author.name, message.author.email)}
        </div>
        <span className="comment-msg__author">{message.author.name ?? message.author.email}</span>
        <span className="comment-msg__time">{timeAgo(message.createdAt)}</span>
      </div>

      {editing ? (
        <div style={{ marginLeft: 32, marginBottom: 4 }}>
          <textarea
            className="comment-composer__input"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSaveEdit();
              }
              if (e.key === 'Escape') setEditing(false);
            }}
            autoFocus
            rows={2}
          />
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <button
              className="comment-composer__send"
              onClick={handleSaveEdit}
              style={{ width: 'auto', padding: '4px 10px', fontSize: 11 }}
            >
              Save
            </button>
            <button
              className="comment-icon-btn"
              onClick={() => setEditing(false)}
              style={{ fontSize: 11 }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="comment-msg__body">{message.body}</p>
      )}

      {!editing && message.reactions.length > 0 && (
        <MessageReactions
          reactions={message.reactions}
          currentUserId={currentUserId}
          onToggle={handleReaction}
        />
      )}

      {/* Hover actions */}
      <div className="comment-msg__hover-actions">
        <div style={{ position: 'relative' }}>
          <button
            ref={emojiTriggerRef}
            className="comment-icon-btn"
            onClick={() => setShowEmojiPicker((v) => !v)}
            title="Add reaction"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="8" cy="8" r="6.5" />
              <path d="M5.5 9.5s1 1.5 2.5 1.5 2.5-1.5 2.5-1.5" />
              <circle cx="6" cy="7" r="0.5" fill="currentColor" />
              <circle cx="10" cy="7" r="0.5" fill="currentColor" />
            </svg>
          </button>
          {showEmojiPicker && (
            <CommentEmojiPicker
              anchorRef={emojiTriggerRef}
              onSelect={(emoji) => {
                handleReaction(emoji);
                setShowEmojiPicker(false);
              }}
              onClose={() => setShowEmojiPicker(false)}
              autoFocusSearch={true}
            />
          )}
        </div>
        {menuItems.length > 0 && (
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
        )}
      </div>
    </div>
  );
}

export const CommentMessageItem = memo(CommentMessageItemInner);
