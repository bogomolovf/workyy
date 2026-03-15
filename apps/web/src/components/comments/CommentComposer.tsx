'use client';

import { useRef, useEffect, useCallback, useState, memo } from 'react';
import { CommentEmojiPicker } from './CommentEmojiPicker';

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  placeholder?: string;
  submitting?: boolean;
  autoFocus?: boolean;
};

function CommentComposerInner({
  value,
  onChange,
  onSubmit,
  onCancel,
  placeholder = 'Add a comment\u2026',
  submitting = false,
  autoFocus = true,
}: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const emojiBtnRef = useRef<HTMLButtonElement>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (value.trim()) onSubmit();
      }
      if (e.key === 'Escape') {
        if (emojiPickerOpen) setEmojiPickerOpen(false);
        else onCancel();
      }
    },
    [value, onSubmit, onCancel, emojiPickerOpen],
  );

  const insertEmoji = useCallback(
    (emoji: string) => {
      const el = inputRef.current;
      if (!el) {
        onChange(value + emoji);
        return;
      }
      const start = el.selectionStart;
      const end = el.selectionEnd ?? start;
      const newValue = value.slice(0, start) + emoji + value.slice(end);
      onChange(newValue);
      setEmojiPickerOpen(false);
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + emoji.length;
        el.setSelectionRange(pos, pos);
      });
    },
    [value, onChange],
  );

  return (
    <div className="comment-composer">
      <textarea
        ref={inputRef}
        className="comment-composer__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={1}
        disabled={submitting}
      />
      <div className="comment-composer__actions">
        <button
          ref={emojiBtnRef}
          type="button"
          className="comment-composer__emoji-btn"
          onClick={() => setEmojiPickerOpen((open) => !open)}
          disabled={submitting}
          title="Add emoji"
          aria-label="Add emoji"
        >
          {/* Miro-style: smiley face + small plus on top-right */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="8" cy="8" r="6" />
            <circle cx="5.5" cy="7.2" r="0.9" fill="currentColor" stroke="none" />
            <circle cx="10.5" cy="7.2" r="0.9" fill="currentColor" stroke="none" />
            <path d="M6 9.8 Q8 11.2 10 9.8" />
            <path d="M11.2 3.2h1.6M12 2.4v1.6" strokeWidth="1.2" />
          </svg>
        </button>
        <button
          className="comment-composer__send"
          onClick={onSubmit}
          disabled={!value.trim() || submitting}
          title="Send (Enter)"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1.5 1.5L14.5 8L1.5 14.5V9.5L10 8L1.5 6.5V1.5Z" />
          </svg>
        </button>
      </div>
      {emojiPickerOpen && (
        <CommentEmojiPicker
          anchorRef={emojiBtnRef}
          onSelect={insertEmoji}
          onClose={() => setEmojiPickerOpen(false)}
          autoFocusSearch={false}
        />
      )}
    </div>
  );
}

export const CommentComposer = memo(CommentComposerInner);
