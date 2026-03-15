'use client';

import { useMemo } from 'react';
import type { EditingUser } from '../hooks/useEditingPresence';

type EditingIndicatorProps = {
  editors: EditingUser[];
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  className?: string;
};

export function EditingIndicator({
  editors,
  position = 'top-right',
  className = '',
}: EditingIndicatorProps) {
  if (editors.length === 0) {
    return null;
  }

  const positionStyles = useMemo(() => {
    switch (position) {
      case 'top-left':
        return 'top-0 left-0 -translate-y-full';
      case 'top-right':
        return 'top-0 right-0 -translate-y-full';
      case 'bottom-left':
        return 'bottom-0 left-0 translate-y-full';
      case 'bottom-right':
        return 'bottom-0 right-0 translate-y-full';
      default:
        return 'top-0 right-0 -translate-y-full';
    }
  }, [position]);

  const displayText = useMemo(() => {
    if (editors.length === 1) {
      const editor = editors[0];
      const name = editor.userName || 'Someone';
      const truncated = name.length > 15 ? `${name.slice(0, 13)}...` : name;
      return `${truncated} is typing`;
    }
    return `${editors.length} users typing`;
  }, [editors]);

  const primaryColor = editors[0]?.color || '#6366f1';

  return (
    <div
      className={`absolute ${positionStyles} z-50 pointer-events-none ${className}`}
      style={{ marginTop: position.startsWith('top') ? '-6px' : '6px' }}
    >
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg shadow-lg text-sm font-semibold text-white whitespace-nowrap"
        style={{
          backgroundColor: primaryColor,
          boxShadow: `0 2px 8px ${primaryColor}66`,
        }}
      >
        <span className="flex gap-[3px] items-center">
          <span
            className="w-1.5 h-1.5 rounded-full bg-white animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="w-1.5 h-1.5 rounded-full bg-white animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="w-1.5 h-1.5 rounded-full bg-white animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </span>
        <span>{displayText}</span>
      </div>
    </div>
  );
}

/**
 * Border highlight component for nodes being edited by others
 */
export function EditingBorder({
  editors,
  children,
  className = '',
}: {
  editors: EditingUser[];
  children: React.ReactNode;
  className?: string;
}) {
  if (editors.length === 0) {
    return <>{children}</>;
  }

  const primaryColor = editors[0]?.color || '#6366f1';

  return (
    <div
      className={`relative ${className}`}
      style={{
        boxShadow: `0 0 0 2px ${primaryColor}`,
        borderRadius: 'inherit',
      }}
    >
      {children}
      <EditingIndicator editors={editors} position="top-right" />
    </div>
  );
}
