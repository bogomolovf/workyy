'use client';

import { useState, useCallback, useRef, memo } from 'react';
import type { Reaction } from '../../lib/commentApi';
import { CommentEmojiPicker } from './CommentEmojiPicker';

type Props = {
  reactions: Reaction[];
  currentUserId: string;
  onToggle: (emoji: string) => void;
};

function MessageReactionsInner({ reactions, currentUserId, onToggle }: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Aggregate reactions: { emoji -> { count, hasOwn } }
  const aggregated = new Map<string, { count: number; hasOwn: boolean }>();
  for (const r of reactions) {
    const entry = aggregated.get(r.emoji) ?? { count: 0, hasOwn: false };
    entry.count++;
    if (r.userId === currentUserId) entry.hasOwn = true;
    aggregated.set(r.emoji, entry);
  }

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      onToggle(emoji);
      setShowPicker(false);
    },
    [onToggle],
  );

  if (aggregated.size === 0 && !showPicker) return null;

  return (
    <div className="comment-reactions">
      {Array.from(aggregated.entries()).map(([emoji, { count, hasOwn }]) => (
        <button
          key={emoji}
          className={`comment-reaction${hasOwn ? ' comment-reaction--active' : ''}`}
          onClick={() => onToggle(emoji)}
        >
          <span>{emoji}</span>
          <span className="comment-reaction__count">{count}</span>
        </button>
      ))}
      <div style={{ position: 'relative', display: 'inline-flex' }}>
        <button
          ref={triggerRef}
          className="comment-reaction comment-reaction--add"
          onClick={() => setShowPicker((v) => !v)}
          title="Add reaction"
        >
          +
        </button>
        {showPicker && (
          <CommentEmojiPicker
            anchorRef={triggerRef}
            onSelect={handleEmojiSelect}
            onClose={() => setShowPicker(false)}
            autoFocusSearch={true}
          />
        )}
      </div>
    </div>
  );
}

export const MessageReactions = memo(MessageReactionsInner);
