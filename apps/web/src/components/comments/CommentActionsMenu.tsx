'use client';

import { useEffect, useRef, memo } from 'react';

export type ActionItem = {
  label: string;
  icon?: string;
  danger?: boolean;
  onClick: () => void;
};

type Props = {
  items: ActionItem[];
  onClose: () => void;
};

function CommentActionsMenuInner({ items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  return (
    <div ref={ref} className="comment-actions-menu">
      {items.map((item, i) => (
        <button
          key={i}
          className={`comment-actions-menu__item${item.danger ? ' comment-actions-menu__item--danger' : ''}`}
          onClick={() => {
            item.onClick();
            onClose();
          }}
        >
          {item.icon && <span>{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </div>
  );
}

export const CommentActionsMenu = memo(CommentActionsMenuInner);
