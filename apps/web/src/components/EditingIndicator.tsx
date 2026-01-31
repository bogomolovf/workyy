'use client';

import { useMemo } from 'react';
import type { EditingUser } from '../hooks/useEditingPresence';

type EditingIndicatorProps = {
  editors: EditingUser[];
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  className?: string;
};

/**
 * Shows a badge indicating who is currently editing the node
 * Displays user names/emails with their cursor colors
 */
export function EditingIndicator({
  editors,
  position = 'top-right',
  className = '',
}: EditingIndicatorProps) {
  // Don't render if no one else is editing
  if (editors.length === 0) {
    return null;
  }

  // Position styles
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

  // Format display text
  const displayText = useMemo(() => {
    if (editors.length === 1) {
      const editor = editors[0];
      const name = editor.userName || 'Someone';
      // Truncate long names
      return name.length > 12 ? `${name.slice(0, 10)}...` : name;
    }
    return `${editors.length} users`;
  }, [editors]);

  // Get primary color (first editor's color)
  const primaryColor = editors[0]?.color || '#6366f1';

  return (
    <div
      className={`absolute ${positionStyles} z-50 pointer-events-none ${className}`}
      style={{ marginTop: position.startsWith('top') ? '-4px' : '4px' }}
    >
      <div
        className="flex items-center gap-1.5 px-2 py-1 rounded-md shadow-md text-xs font-medium text-white whitespace-nowrap animate-pulse"
        style={{
          backgroundColor: primaryColor,
          opacity: 0.95,
        }}
      >
        {/* Typing indicator dots */}
        <span className="flex gap-0.5">
          <span
            className="w-1 h-1 rounded-full bg-white animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="w-1 h-1 rounded-full bg-white animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="w-1 h-1 rounded-full bg-white animate-bounce"
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
