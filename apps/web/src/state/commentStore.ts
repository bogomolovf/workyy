import { create } from 'zustand';
import type { ThreadSummary, ThreadDetail, CommentMessageData, Reaction } from '../lib/commentApi';
import * as api from '../lib/commentApi';

// ─── Types ────────────────────────────────────────────────────────────

export type CommentAnchor = {
  x: number;
  y: number;
  nodeId?: string;
};

type CommentState = {
  boardId: string | null;
  threads: Record<string, ThreadSummary>;
  /** Full thread data (with messages) for the active thread */
  activeThread: ThreadDetail | null;
  activeThreadId: string | null;
  /** Anchor for the new-comment composer (flow coordinates) */
  composerAnchor: CommentAnchor | null;
  /** Unsaved draft texts keyed by threadId or 'composer' */
  draftTexts: Record<string, string>;
  loading: boolean;
  submitting: boolean;
  error: string | null;
  /** Polling interval handle */
  _pollTimer: ReturnType<typeof setInterval> | null;
  /** Thread IDs with pending anchor moves — polling must not overwrite their positions */
  _pendingMoves: Set<string>;
};

type CommentActions = {
  // Lifecycle
  loadThreads: (boardId: string) => Promise<void>;
  startPolling: (boardId: string, intervalMs?: number) => void;
  stopPolling: () => void;

  // Thread navigation
  openThread: (threadId: string) => Promise<void>;
  closeThread: () => void;

  // Composer
  startComposer: (anchor: CommentAnchor) => void;
  cancelComposer: () => void;

  // Mutations with optimistic updates
  submitThread: (boardId: string, body: string) => Promise<void>;
  submitReply: (boardId: string, threadId: string, body: string) => Promise<void>;
  resolveThread: (boardId: string, threadId: string, resolved: boolean) => Promise<void>;
  deleteThread: (boardId: string, threadId: string) => Promise<void>;
  editMessage: (
    boardId: string,
    threadId: string,
    messageId: string,
    body: string,
  ) => Promise<void>;
  deleteMessage: (boardId: string, threadId: string, messageId: string) => Promise<void>;
  toggleReaction: (
    boardId: string,
    threadId: string,
    messageId: string,
    emoji: string,
    userId: string,
  ) => Promise<void>;
  toggleSubscription: (boardId: string, threadId: string, subscribed: boolean) => Promise<void>;
  moveThreadAnchor: (
    boardId: string,
    threadId: string,
    anchorX: number,
    anchorY: number,
  ) => Promise<void>;

  // Drafts
  setDraft: (key: string, text: string) => void;
  getDraft: (key: string) => string;
  clearDraft: (key: string) => void;
};

export type CommentStore = CommentState & CommentActions;

// ─── Store ────────────────────────────────────────────────────────────

export const useCommentStore = create<CommentStore>((set, get) => ({
  boardId: null,
  threads: {},
  activeThread: null,
  activeThreadId: null,
  composerAnchor: null,
  draftTexts: {},
  loading: false,
  submitting: false,
  error: null,
  _pollTimer: null,
  _pendingMoves: new Set(),

  // ─── Load all threads for a board ─────────────────────────────────
  loadThreads: async (boardId) => {
    set({ loading: true, error: null, boardId });
    try {
      const threads = await api.fetchThreads(boardId);
      const map: Record<string, ThreadSummary> = {};
      const pending = get()._pendingMoves;
      for (const t of threads) {
        // Preserve optimistic anchor position for threads with pending moves
        if (pending.has(t.id)) {
          const existing = get().threads[t.id];
          if (existing) {
            map[t.id] = { ...t, anchorX: existing.anchorX, anchorY: existing.anchorY };
            continue;
          }
        }
        map[t.id] = t;
      }
      set({ threads: map, loading: false });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load comments';
      set({ error: msg, loading: false });
    }
  },

  // ─── Polling for background sync ──────────────────────────────────
  startPolling: (boardId, intervalMs = 1_000) => {
    const { _pollTimer } = get();
    if (_pollTimer) clearInterval(_pollTimer);
    const timer = setInterval(() => {
      get().loadThreads(boardId);
      // Also refresh the active thread so new messages appear in real-time
      const { activeThreadId } = get();
      if (activeThreadId) {
        api.fetchThread(boardId, activeThreadId).then((detail) => {
          // Only update if this thread is still active
          if (get().activeThreadId === activeThreadId) {
            set({ activeThread: detail });
          }
        }).catch(() => {
          // Silently ignore - will retry on next poll
        });
      }
    }, intervalMs);
    set({ _pollTimer: timer });
  },

  stopPolling: () => {
    const { _pollTimer } = get();
    if (_pollTimer) {
      clearInterval(_pollTimer);
      set({ _pollTimer: null });
    }
  },

  // ─── Thread navigation ────────────────────────────────────────────
  openThread: async (threadId) => {
    const { boardId } = get();
    if (!boardId) return;
    set({ activeThreadId: threadId, composerAnchor: null });
    try {
      const detail = await api.fetchThread(boardId, threadId);
      set({ activeThread: detail });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load thread';
      set({ error: msg });
    }
  },

  closeThread: () => {
    set({ activeThreadId: null, activeThread: null });
  },

  // ─── Composer ─────────────────────────────────────────────────────
  startComposer: (anchor) => {
    set({ composerAnchor: anchor, activeThreadId: null, activeThread: null });
  },

  cancelComposer: () => {
    set({ composerAnchor: null });
  },

  // ─── Create thread ────────────────────────────────────────────────
  submitThread: async (boardId, body) => {
    const { composerAnchor } = get();
    if (!composerAnchor) return;
    set({ submitting: true, error: null });
    try {
      const thread = await api.createThread(boardId, {
        body,
        anchorX: composerAnchor.x,
        anchorY: composerAnchor.y,
        nodeId: composerAnchor.nodeId ?? null,
      });
      set((s) => ({
        submitting: false,
        composerAnchor: null,
        activeThreadId: thread.id,
        activeThread: thread,
        threads: {
          ...s.threads,
          [thread.id]: {
            id: thread.id,
            boardId: thread.boardId,
            nodeId: thread.nodeId,
            anchorX: thread.anchorX,
            anchorY: thread.anchorY,
            resolved: thread.resolved,
            resolvedAt: thread.resolvedAt,
            createdById: thread.createdById,
            createdBy: thread.createdBy,
            resolvedBy: thread.resolvedBy,
            createdAt: thread.createdAt,
            updatedAt: thread.updatedAt,
            messageCount: thread.messages.length,
            firstMessage: thread.messages[0]
              ? {
                  id: thread.messages[0].id,
                  body: thread.messages[0].body,
                  authorId: thread.messages[0].authorId,
                  createdAt: thread.messages[0].createdAt,
                  author: thread.messages[0].author,
                }
              : null,
            subscribed: true,
          },
        },
      }));
      get().clearDraft('composer');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create comment';
      set({ error: msg, submitting: false });
    }
  },

  // ─── Reply ────────────────────────────────────────────────────────
  submitReply: async (boardId, threadId, body) => {
    set({ submitting: true, error: null });
    try {
      const message = await api.addReply(boardId, threadId, body);
      set((s) => {
        const activeThread = s.activeThread;
        if (activeThread && activeThread.id === threadId) {
          return {
            submitting: false,
            activeThread: {
              ...activeThread,
              messages: [...activeThread.messages, { ...message, deleted: false }],
            },
            threads: {
              ...s.threads,
              [threadId]: s.threads[threadId]
                ? {
                    ...s.threads[threadId],
                    messageCount: (s.threads[threadId].messageCount ?? 0) + 1,
                  }
                : s.threads[threadId],
            },
          };
        }
        return { submitting: false };
      });
      get().clearDraft(threadId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send reply';
      set({ error: msg, submitting: false });
    }
  },

  // ─── Resolve / Unresolve ──────────────────────────────────────────
  resolveThread: async (boardId, threadId, resolved) => {
    // Optimistic update
    set((s) => ({
      threads: s.threads[threadId]
        ? { ...s.threads, [threadId]: { ...s.threads[threadId], resolved } }
        : s.threads,
      activeThread:
        s.activeThread?.id === threadId ? { ...s.activeThread, resolved } : s.activeThread,
    }));
    try {
      await api.resolveThread(boardId, threadId, resolved);
    } catch {
      // Revert on error
      set((s) => ({
        threads: s.threads[threadId]
          ? { ...s.threads, [threadId]: { ...s.threads[threadId], resolved: !resolved } }
          : s.threads,
        activeThread:
          s.activeThread?.id === threadId
            ? { ...s.activeThread, resolved: !resolved }
            : s.activeThread,
      }));
    }
  },

  // ─── Delete thread ────────────────────────────────────────────────
  deleteThread: async (boardId, threadId) => {
    const prev = get().threads[threadId];
    set((s) => {
      const next = { ...s.threads };
      delete next[threadId];
      return {
        threads: next,
        activeThreadId: s.activeThreadId === threadId ? null : s.activeThreadId,
        activeThread: s.activeThread?.id === threadId ? null : s.activeThread,
      };
    });
    try {
      await api.deleteThread(boardId, threadId);
    } catch {
      if (prev) {
        set((s) => ({ threads: { ...s.threads, [threadId]: prev } }));
      }
    }
  },

  // ─── Edit message ─────────────────────────────────────────────────
  editMessage: async (boardId, threadId, messageId, body) => {
    try {
      const updated = await api.editMessage(boardId, threadId, messageId, body);
      set((s) => {
        if (s.activeThread?.id !== threadId) return {};
        return {
          activeThread: {
            ...s.activeThread,
            messages: s.activeThread.messages.map((m) =>
              m.id === messageId ? { ...m, body: updated.body, updatedAt: updated.updatedAt } : m,
            ),
          },
        };
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to edit message';
      set({ error: msg });
    }
  },

  // ─── Delete message ───────────────────────────────────────────────
  deleteMessage: async (boardId, threadId, messageId) => {
    set((s) => {
      if (s.activeThread?.id !== threadId) return {};
      return {
        activeThread: {
          ...s.activeThread,
          messages: s.activeThread.messages.map((m) =>
            m.id === messageId ? { ...m, deleted: true, body: '' } : m,
          ),
        },
      };
    });
    try {
      await api.deleteMessage(boardId, threadId, messageId);
    } catch (err: unknown) {
      // Refetch to get consistent state on failure
      const detail = await api.fetchThread(boardId, threadId);
      set({ activeThread: detail });
    }
  },

  // ─── Toggle reaction (optimistic) ─────────────────────────────────
  toggleReaction: async (boardId, threadId, messageId, emoji, userId) => {
    // Optimistic: toggle the reaction in activeThread.messages
    set((s) => {
      if (s.activeThread?.id !== threadId) return {};
      return {
        activeThread: {
          ...s.activeThread,
          messages: s.activeThread.messages.map((m) => {
            if (m.id !== messageId) return m;
            const has = m.reactions.some((r) => r.emoji === emoji && r.userId === userId);
            const reactions = has
              ? m.reactions.filter((r) => !(r.emoji === emoji && r.userId === userId))
              : [...m.reactions, { messageId, emoji, userId }];
            return { ...m, reactions };
          }),
        },
      };
    });
    try {
      const result = await api.toggleReaction(boardId, threadId, messageId, emoji);
      // Reconcile with server state
      set((s) => {
        if (s.activeThread?.id !== threadId) return {};
        return {
          activeThread: {
            ...s.activeThread,
            messages: s.activeThread.messages.map((m) =>
              m.id === messageId
                ? { ...m, reactions: result.reactions.map((r) => ({ ...r, messageId })) }
                : m,
            ),
          },
        };
      });
    } catch {
      // Refetch on failure
      if (get().activeThread?.id === threadId) {
        const detail = await api.fetchThread(boardId, threadId);
        set({ activeThread: detail });
      }
    }
  },

  // ─── Subscription ─────────────────────────────────────────────────
  toggleSubscription: async (boardId, threadId, subscribed) => {
    set((s) => ({
      threads: s.threads[threadId]
        ? { ...s.threads, [threadId]: { ...s.threads[threadId], subscribed } }
        : s.threads,
      activeThread:
        s.activeThread?.id === threadId ? { ...s.activeThread, subscribed } : s.activeThread,
    }));
    try {
      await api.toggleSubscription(boardId, threadId, subscribed);
    } catch {
      set((s) => ({
        threads: s.threads[threadId]
          ? { ...s.threads, [threadId]: { ...s.threads[threadId], subscribed: !subscribed } }
          : s.threads,
        activeThread:
          s.activeThread?.id === threadId
            ? { ...s.activeThread, subscribed: !subscribed }
            : s.activeThread,
      }));
    }
  },

  // ─── Move thread anchor (optimistic) ────────────────────────────
  moveThreadAnchor: async (boardId, threadId, anchorX, anchorY) => {
    const prev = get().threads[threadId];
    // Mark thread as having a pending move so polling won't overwrite its position
    get()._pendingMoves.add(threadId);
    // Optimistic: update local position immediately
    set((s) => ({
      threads: s.threads[threadId]
        ? { ...s.threads, [threadId]: { ...s.threads[threadId], anchorX, anchorY } }
        : s.threads,
      activeThread:
        s.activeThread?.id === threadId ? { ...s.activeThread, anchorX, anchorY } : s.activeThread,
    }));
    try {
      await api.moveThreadAnchor(boardId, threadId, anchorX, anchorY);
    } catch (err) {
      console.error('[commentStore] moveThreadAnchor failed, reverting position:', err);
      if (prev) {
        set((s) => ({
          threads: {
            ...s.threads,
            [threadId]: { ...s.threads[threadId], anchorX: prev.anchorX, anchorY: prev.anchorY },
          },
          activeThread:
            s.activeThread?.id === threadId
              ? { ...s.activeThread, anchorX: prev.anchorX, anchorY: prev.anchorY }
              : s.activeThread,
        }));
      }
    } finally {
      // Clear pending flag — by now the server has the new position,
      // so subsequent polls will return the correct value
      get()._pendingMoves.delete(threadId);
    }
  },

  // ─── Drafts ───────────────────────────────────────────────────────
  setDraft: (key, text) => {
    set((s) => ({ draftTexts: { ...s.draftTexts, [key]: text } }));
  },
  getDraft: (key) => get().draftTexts[key] ?? '',
  clearDraft: (key) => {
    set((s) => {
      const next = { ...s.draftTexts };
      delete next[key];
      return { draftTexts: next };
    });
  },
}));
