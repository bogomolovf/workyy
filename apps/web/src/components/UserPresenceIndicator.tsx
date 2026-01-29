'use client';

import { memo, useState, useRef, useEffect } from 'react';
import { Users } from '@phosphor-icons/react';

export interface PresenceUser {
  id: string;
  name?: string;
  color: string;
}

interface UserPresenceIndicatorProps {
  users: PresenceUser[];
  currentUserId?: string;
}

/**
 * Displays the number of users currently viewing the board.
 * Shows avatars for up to 3 users, with +N overflow indicator.
 * On hover, shows a dropdown with all users.
 * 
 * Inspired by Miro/Figma/tldraw collaboration indicators.
 */
export const UserPresenceIndicator = memo(function UserPresenceIndicator({
  users,
  currentUserId,
}: UserPresenceIndicatorProps) {
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Filter out current user for display (they see themselves in the list but marked)
  const otherUsers = users.filter((u) => u.id !== currentUserId);
  const totalCount = users.length;

  // Show max 3 avatars
  const visibleUsers = otherUsers.slice(0, 3);
  const overflowCount = otherUsers.length - 3;

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setIsHovered(false), 200);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Get initials from name
  const getInitials = (name?: string): string => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // No users (only current user)
  if (totalCount <= 1) {
    return (
      <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-500">
        <Users weight="regular" className="h-4 w-4" />
        <span>Только вы</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Main indicator */}
      <div className="flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5 cursor-default transition-all hover:bg-emerald-100">
        {/* User avatars stack */}
        <div className="flex -space-x-2">
          {visibleUsers.map((user, index) => (
            <div
              key={user.id}
              className="relative flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-white shadow-sm"
              style={{
                backgroundColor: user.color,
                zIndex: visibleUsers.length - index,
              }}
              title={user.name || 'Пользователь'}
            >
              {getInitials(user.name)}
            </div>
          ))}
          {overflowCount > 0 && (
            <div
              className="relative flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-slate-400 text-[10px] font-semibold text-white shadow-sm"
              style={{ zIndex: 0 }}
            >
              +{overflowCount}
            </div>
          )}
        </div>
        {/* Count label */}
        <span className="text-sm font-medium text-emerald-700">
          {totalCount} онлайн
        </span>
      </div>

      {/* Hover dropdown with all users */}
      {isHovered && users.length > 0 && (
        <div
          className="absolute right-0 top-full mt-2 z-50 min-w-[180px] rounded-lg bg-white shadow-lg border border-slate-200 py-2 animate-in fade-in slide-in-from-top-1 duration-150"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="px-3 py-1.5 text-xs font-medium text-slate-400 uppercase tracking-wide border-b border-slate-100 mb-1">
            На доске
          </div>
          {users.map((user) => {
            const isCurrent = user.id === currentUserId;
            return (
              <div
                key={user.id}
                className={`flex items-center gap-2.5 px-3 py-1.5 ${
                  isCurrent ? 'bg-slate-50' : ''
                }`}
              >
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                  style={{ backgroundColor: user.color }}
                >
                  {getInitials(user.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">
                    {user.name || 'Пользователь'}
                    {isCurrent && (
                      <span className="ml-1.5 text-xs text-slate-400">(вы)</span>
                    )}
                  </p>
                </div>
                {/* Online indicator dot */}
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

export default UserPresenceIndicator;
