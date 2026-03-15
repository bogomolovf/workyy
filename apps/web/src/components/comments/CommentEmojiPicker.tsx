'use client';

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useLayoutEffect,
  useMemo,
  memo,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import {
  EMOJI_CATEGORIES,
  EMOJI_BY_CATEGORY,
  getRecentEmojis,
  addToRecentEmojis,
  clearRecentEmojis,
  searchEmojis,
  type EmojiCategoryId,
} from './emojiData';

const PICKER_WIDTH = 320;
const PICKER_MAX_HEIGHT = 380;
const GAP = 6;
const PAD = 16;

type Props = {
  onSelect: (emoji: string) => void;
  onClose?: () => void;
  /** Optional: focus search on open */
  autoFocusSearch?: boolean;
  /** Ref to the trigger element: picker is rendered in a portal and positioned bottom-right of it, floating on top */
  anchorRef?: RefObject<HTMLElement | null>;
};

function getViewportMetrics() {
  const vv = typeof window !== 'undefined' && window.visualViewport;
  const layoutH = typeof window !== 'undefined' ? window.innerHeight : 800;
  const layoutW = typeof window !== 'undefined' ? window.innerWidth : 320;
  if (vv) {
    return {
      visibleHeight: vv.height,
      visibleWidth: vv.width,
      offsetTop: vv.offsetTop,
      offsetLeft: vv.offsetLeft,
      bottomForPicker: layoutH - vv.offsetTop - vv.height + PAD,
      maxHeight: Math.min(PICKER_MAX_HEIGHT, vv.height - PAD * 2),
    };
  }
  return {
    visibleHeight: layoutH,
    visibleWidth: layoutW,
    offsetTop: 0,
    offsetLeft: 0,
    bottomForPicker: PAD,
    maxHeight: Math.min(PICKER_MAX_HEIGHT, layoutH - PAD * 2),
  };
}

function CommentEmojiPickerInner({ onSelect, onClose, autoFocusSearch = true, anchorRef }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<EmojiCategoryId>('people');
  const [recent, setRecent] = useState<string[]>(() => getRecentEmojis());
  const [position, setPosition] = useState<{ left: number; top: number; maxHeight: number } | null>(
    null,
  );
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRecent(getRecentEmojis());
  }, []);

  useEffect(() => {
    if (!autoFocusSearch) return;
    searchInputRef.current?.focus();
  }, [autoFocusSearch]);

  // Позиция: справа от кнопки; по вертикали — ближе к центру экрана.
  // Если кнопка в нижней половине → пикер открывается вверх (нижний край у кнопки).
  // Если кнопка в верхней половине → пикер открывается вниз (верхний край у кнопки).
  const updatePosition = useCallback(() => {
    if (!anchorRef?.current || typeof document === 'undefined') return;
    const rect = anchorRef.current.getBoundingClientRect();
    const { visibleHeight, visibleWidth, offsetLeft, offsetTop, maxHeight } = getViewportMetrics();

    // Горизонталь: справа от кнопки, не вылезая за правый/левый край
    const maxLeft = offsetLeft + visibleWidth - PICKER_WIDTH - PAD;
    let left = Math.round(rect.right + GAP);
    if (left > maxLeft) left = maxLeft;
    if (left < offsetLeft + PAD) left = offsetLeft + PAD;

    // Вертикаль: определяем, в какой половине экрана кнопка
    const btnCenterY = (rect.top + rect.bottom) / 2;
    const viewMidY = offsetTop + visibleHeight / 2;
    const pickerH = maxHeight;
    let top: number;

    if (btnCenterY > viewMidY) {
      // Кнопка в нижней половине → пикер растёт вверх от кнопки
      top = Math.round(rect.top - pickerH - GAP);
    } else {
      // Кнопка в верхней половине → пикер растёт вниз от кнопки
      top = Math.round(rect.bottom + GAP);
    }

    // Ограничение по видимой области
    if (top + pickerH > offsetTop + visibleHeight - PAD) {
      top = offsetTop + visibleHeight - pickerH - PAD;
    }
    if (top < offsetTop + PAD) {
      top = offsetTop + PAD;
    }

    setPosition({ left, top, maxHeight });
  }, [anchorRef]);

  useLayoutEffect(() => {
    updatePosition();
  }, [updatePosition]);

  useEffect(() => {
    const vv = typeof window !== 'undefined' && window.visualViewport;
    if (!vv) return;
    vv.addEventListener('resize', updatePosition);
    vv.addEventListener('scroll', updatePosition);
    return () => {
      vv.removeEventListener('resize', updatePosition);
      vv.removeEventListener('scroll', updatePosition);
    };
  }, [updatePosition]);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef?.current?.contains(target)) return;
      if (pickerRef.current && !pickerRef.current.contains(target)) {
        onClose?.();
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose, anchorRef]);

  const handleEmojiClick = useCallback(
    (emoji: string) => {
      addToRecentEmojis(emoji);
      setRecent(getRecentEmojis());
      onSelect(emoji);
      onClose?.();
    },
    [onSelect, onClose],
  );

  const handleClearRecent = useCallback(() => {
    clearRecentEmojis();
    setRecent([]);
  }, []);

  const searchResults = useMemo(
    () => (searchQuery.trim() ? searchEmojis(searchQuery) : []),
    [searchQuery],
  );
  const showSearchResults = searchQuery.trim().length > 0;

  const renderGrid = (emojis: string[]) => (
    <div className="comment-emoji-picker__grid">
      {emojis.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="comment-emoji-picker__btn"
          onClick={() => handleEmojiClick(emoji)}
          title={emoji}
        >
          {emoji}
        </button>
      ))}
    </div>
  );

  const pickerContent = (
    <div
      ref={pickerRef}
      className="comment-emoji-picker comment-emoji-picker--full"
      style={position ? { height: position.maxHeight, maxHeight: position.maxHeight } : undefined}
    >
      {/* Search bar */}
      <div className="comment-emoji-picker__search-wrap">
        <span className="comment-emoji-picker__search-icon" aria-hidden>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </span>
        <input
          ref={searchInputRef}
          type="text"
          className="comment-emoji-picker__search-input"
          placeholder="Search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && (setSearchQuery(''), onClose?.())}
        />
        {searchQuery.length > 0 && (
          <button
            type="button"
            className="comment-emoji-picker__search-clear"
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* Category tabs */}
      <div className="comment-emoji-picker__tabs">
        {EMOJI_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={`comment-emoji-picker__tab ${activeCategory === cat.id ? 'comment-emoji-picker__tab--active' : ''}`}
            onClick={() => setActiveCategory(cat.id)}
            title={cat.label}
          >
            {cat.icon}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="comment-emoji-picker__content">
        {showSearchResults ? (
          <>
            {searchResults.length > 0 ? (
              renderGrid(searchResults)
            ) : (
              <p className="comment-emoji-picker__empty">No emojis found</p>
            )}
          </>
        ) : activeCategory === 'recent' ? (
          <>
            <div className="comment-emoji-picker__section-header">
              <span>Recent</span>
              {recent.length > 0 && (
                <button
                  type="button"
                  className="comment-emoji-picker__clear-btn"
                  onClick={handleClearRecent}
                >
                  Clear
                </button>
              )}
            </div>
            {recent.length > 0 ? (
              renderGrid(recent)
            ) : (
              <p className="comment-emoji-picker__empty">No recent emojis</p>
            )}
          </>
        ) : (
          <>
            <div className="comment-emoji-picker__section-header">
              <span>
                {EMOJI_CATEGORIES.find((c) => c.id === activeCategory)?.label ?? activeCategory}
              </span>
            </div>
            {renderGrid(EMOJI_BY_CATEGORY[activeCategory] ?? [])}
          </>
        )}
      </div>
    </div>
  );

  // Render in portal with fixed position so picker is visible on top of canvas, not clipped by card overflow
  if (anchorRef && typeof document !== 'undefined') {
    if (!position) return null; // wait for useLayoutEffect to set position
    return createPortal(
      <div
        className="comment-emoji-picker-portal"
        style={{
          position: 'fixed',
          left: position.left,
          top: position.top,
          zIndex: 10000,
        }}
      >
        {pickerContent}
      </div>,
      document.body,
    );
  }

  return pickerContent;
}

export const CommentEmojiPicker = memo(CommentEmojiPickerInner);
