'use client';

import { Phone, PhoneDisconnect, Microphone, MicrophoneSlash, Users } from '@phosphor-icons/react';
import { memo } from 'react';
import type { CallParticipant } from '../state/audioCallStore';

type AudioCallPanelProps = {
  inCall: boolean;
  localMuted: boolean;
  participants: Record<string, CallParticipant>;
  panelOpen: boolean;
  error: string | null;
  currentUserName?: string;
  /** Number of other users currently in the call (when we're not in yet) */
  activeCallParticipantCount?: number;
  onJoin: () => void;
  onLeave: () => void;
  onToggleMute: () => void;
  onTogglePanel: () => void;
};

/**
 * Floating audio-call panel shown in the board header area.
 *
 * States:
 *   - Not in call → green "Join call" button
 *   - In call → mute toggle + leave button + participant count badge
 *   - Panel expanded → list of participants with mute indicators
 */
export const AudioCallPanel = memo(function AudioCallPanel({
  inCall,
  localMuted,
  participants,
  panelOpen,
  error,
  currentUserName,
  activeCallParticipantCount = 0,
  onJoin,
  onLeave,
  onToggleMute,
  onTogglePanel,
}: AudioCallPanelProps) {
  const participantList = Object.values(participants);
  const participantCount = participantList.length;

  // ── Not in call ────────────────────────────────────────────────────
  if (!inCall) {
    const hasActiveCall = activeCallParticipantCount > 0;

    return (
      <div className="relative flex items-center gap-2">
        <button
          type="button"
          onClick={onJoin}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors focus:outline-none focus:ring-2 ${
            hasActiveCall
              ? 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-300 animate-pulse'
              : 'bg-emerald-500 hover:bg-emerald-600 focus:ring-emerald-300'
          }`}
          title={hasActiveCall ? 'Присоединиться к звонку' : 'Начать звонок'}
        >
          <Phone weight="bold" className="h-4 w-4" />
          <span>
            {hasActiveCall ? `Присоединиться (${activeCallParticipantCount})` : 'Позвонить'}
          </span>
        </button>
        {error && (
          <span className="text-xs text-rose-500 max-w-[180px] truncate" title={error}>
            {error}
          </span>
        )}
      </div>
    );
  }

  // ── In call ────────────────────────────────────────────────────────
  return (
    <div className="relative flex items-center gap-1.5">
      {/* Mute / unmute */}
      <button
        type="button"
        onClick={onToggleMute}
        className={`flex items-center justify-center rounded-full p-1.5 transition-colors focus:outline-none focus:ring-2 ${
          localMuted
            ? 'bg-rose-100 text-rose-600 hover:bg-rose-200 focus:ring-rose-300'
            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 focus:ring-slate-300'
        }`}
        title={localMuted ? 'Unmute' : 'Mute'}
      >
        {localMuted ? (
          <MicrophoneSlash weight="bold" className="h-4 w-4" />
        ) : (
          <Microphone weight="bold" className="h-4 w-4" />
        )}
      </button>

      {/* Participant count / expand panel */}
      <button
        type="button"
        onClick={onTogglePanel}
        className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-300"
        title="Show call participants"
      >
        <Users weight="bold" className="h-3.5 w-3.5" />
        <span>{participantCount + 1}</span>
      </button>

      {/* Leave */}
      <button
        type="button"
        onClick={onLeave}
        className="flex items-center justify-center rounded-full bg-rose-500 p-1.5 text-white hover:bg-rose-600 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-300"
        title="Leave call"
      >
        <PhoneDisconnect weight="bold" className="h-4 w-4" />
      </button>

      {/* Expanded participant list */}
      {panelOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-lg z-[1400]">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            In call ({participantCount + 1})
          </h4>
          <ul className="space-y-1.5">
            {/* Current user */}
            <li className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1 text-sm">
              <span className="truncate text-slate-700">
                {currentUserName ?? 'You'} <span className="text-slate-400">(вы)</span>
              </span>
              {localMuted && (
                <MicrophoneSlash
                  weight="bold"
                  className="h-3.5 w-3.5 text-rose-400 flex-shrink-0"
                />
              )}
            </li>
            {/* Remote participants */}
            {participantList.map((p) => (
              <li
                key={p.clientId}
                className="flex items-center justify-between rounded-md px-2 py-1 text-sm"
              >
                <span className="truncate text-slate-700">{p.name}</span>
                {p.muted && (
                  <MicrophoneSlash
                    weight="bold"
                    className="h-3.5 w-3.5 text-rose-400 flex-shrink-0"
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <span className="ml-1 text-xs text-rose-500 max-w-[140px] truncate" title={error}>
          {error}
        </span>
      )}
    </div>
  );
});
