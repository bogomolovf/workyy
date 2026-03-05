/**
 * Shared types and helpers for presentation broadcast state (Yjs-synced).
 * One broadcaster per presentation node; viewers follow broadcast.slideIndex when followMode is true.
 */

export type PresentationBroadcastState = {
  isActive: boolean;
  presenterUserId: string;
  presenterName: string;
  slideIndex: number;
  updatedAt: number;
};

export const DEFAULT_BROADCAST_STATE: PresentationBroadcastState = {
  isActive: false,
  presenterUserId: '',
  presenterName: '',
  slideIndex: 0,
  updatedAt: 0,
};

export function getBroadcastStateFromYjs(
  map: { get: (key: string) => unknown },
  presentationNodeId: string,
): PresentationBroadcastState | null {
  const raw = map.get(presentationNodeId);
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  return {
    isActive: Boolean(o.isActive),
    presenterUserId: String(o.presenterUserId ?? ''),
    presenterName: String(o.presenterName ?? ''),
    slideIndex: Number(o.slideIndex) || 0,
    updatedAt: Number(o.updatedAt) || 0,
  };
}

export function isBroadcastActive(state: PresentationBroadcastState | null): boolean {
  return state?.isActive === true && Boolean(state.presenterUserId);
}
