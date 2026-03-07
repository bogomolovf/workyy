/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  getBroadcastStateFromYjs,
  isBroadcastActive,
  DEFAULT_BROADCAST_STATE,
  type PresentationBroadcastState,
} from './presentationBroadcast';

describe('presentationBroadcast', () => {
  describe('getBroadcastStateFromYjs', () => {
    it('returns null for missing key', () => {
      const map = { get: (): unknown => undefined };
      expect(getBroadcastStateFromYjs(map, 'node-1')).toBeNull();
    });

    it('returns null for non-object value', () => {
      const map = { get: (): unknown => 'string' };
      expect(getBroadcastStateFromYjs(map, 'node-1')).toBeNull();
    });

    it('returns normalized state for valid object', () => {
      const map = {
        get: (): unknown => ({
          isActive: true,
          presenterUserId: 'user-1',
          presenterName: 'Alice',
          slideIndex: 2,
          updatedAt: 1000,
        }),
      };
      const state = getBroadcastStateFromYjs(map, 'node-1');
      expect(state).toEqual({
        isActive: true,
        presenterUserId: 'user-1',
        presenterName: 'Alice',
        slideIndex: 2,
        updatedAt: 1000,
      });
    });

    it('coerces missing fields to defaults', () => {
      const map = { get: (): unknown => ({}) };
      const state = getBroadcastStateFromYjs(map, 'node-1');
      expect(state).toEqual({
        isActive: false,
        presenterUserId: '',
        presenterName: '',
        slideIndex: 0,
        updatedAt: 0,
      });
    });
  });

  describe('isBroadcastActive', () => {
    it('returns false for null', () => {
      expect(isBroadcastActive(null)).toBe(false);
    });

    it('returns false when isActive is false', () => {
      const state: PresentationBroadcastState = {
        ...DEFAULT_BROADCAST_STATE,
        isActive: false,
        presenterUserId: 'user-1',
      };
      expect(isBroadcastActive(state)).toBe(false);
    });

    it('returns false when presenterUserId is empty', () => {
      const state: PresentationBroadcastState = {
        ...DEFAULT_BROADCAST_STATE,
        isActive: true,
        presenterUserId: '',
      };
      expect(isBroadcastActive(state)).toBe(false);
    });

    it('returns true when active and presenter set', () => {
      const state: PresentationBroadcastState = {
        ...DEFAULT_BROADCAST_STATE,
        isActive: true,
        presenterUserId: 'user-1',
        presenterName: 'Alice',
        slideIndex: 1,
        updatedAt: 1000,
      };
      expect(isBroadcastActive(state)).toBe(true);
    });
  });

  describe('single presenter lock (logic)', () => {
    it('only one user can be presenter: second cannot start when first is active', () => {
      const mapState: PresentationBroadcastState = {
        isActive: true,
        presenterUserId: 'user-alice',
        presenterName: 'Alice',
        slideIndex: 0,
        updatedAt: Date.now(),
      };
      const canStart = (userId: string) =>
        !isBroadcastActive(mapState) || mapState.presenterUserId === userId;
      expect(canStart('user-alice')).toBe(true);
      expect(canStart('user-bob')).toBe(false);
    });

    it('any user can start when broadcast is not active', () => {
      const mapState: PresentationBroadcastState = {
        ...DEFAULT_BROADCAST_STATE,
        isActive: false,
      };
      const canStart = (userId: string) =>
        !isBroadcastActive(mapState) || mapState.presenterUserId === userId;
      expect(canStart('user-alice')).toBe(true);
      expect(canStart('user-bob')).toBe(true);
    });
  });

  describe('viewer followMode (logic)', () => {
    it('effective slide is broadcast.slideIndex when followMode and not presenter', () => {
      const broadcastState: PresentationBroadcastState = {
        isActive: true,
        presenterUserId: 'other',
        presenterName: 'Bob',
        slideIndex: 3,
        updatedAt: 1000,
      };
      const amPresenter = false;
      const followMode = true;
      const currentSlideLocal = 0;
      const numPages = 10;
      const effectiveSlide =
        !amPresenter && followMode && isBroadcastActive(broadcastState) && broadcastState != null
          ? Math.max(0, Math.min(broadcastState.slideIndex, numPages - 1))
          : Math.max(0, Math.min(currentSlideLocal, numPages - 1));
      expect(effectiveSlide).toBe(3);
    });

    it('effective slide is local when private (not followMode)', () => {
      const broadcastState: PresentationBroadcastState = {
        isActive: true,
        presenterUserId: 'other',
        presenterName: 'Bob',
        slideIndex: 3,
        updatedAt: 1000,
      };
      const amPresenter = false;
      const followMode = false;
      const currentSlideLocal = 5;
      const numPages = 10;
      const effectiveSlide =
        !amPresenter && followMode && isBroadcastActive(broadcastState) && broadcastState != null
          ? Math.max(0, Math.min(broadcastState.slideIndex, numPages - 1))
          : Math.max(0, Math.min(currentSlideLocal, numPages - 1));
      expect(effectiveSlide).toBe(5);
    });
  });
});
