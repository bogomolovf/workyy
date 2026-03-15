import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCommentStore } from './commentStore';

// Mock the API module
vi.mock('../lib/commentApi', () => ({
  fetchThreads: vi.fn().mockResolvedValue([]),
  fetchThread: vi.fn().mockResolvedValue({
    id: 't1',
    boardId: 'b1',
    nodeId: null,
    anchorX: 100,
    anchorY: 200,
    resolved: false,
    resolvedAt: null,
    createdById: 'u1',
    createdBy: { id: 'u1', name: 'Test', email: 'test@test.com', avatarUrl: null },
    resolvedBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    subscribed: true,
    messages: [],
  }),
  createThread: vi.fn().mockResolvedValue({
    id: 'new-thread',
    boardId: 'b1',
    nodeId: null,
    anchorX: 50,
    anchorY: 60,
    resolved: false,
    resolvedAt: null,
    createdById: 'u1',
    createdBy: { id: 'u1', name: 'Test', email: 'test@test.com', avatarUrl: null },
    resolvedBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    subscribed: true,
    messages: [
      {
        id: 'm1',
        threadId: 'new-thread',
        authorId: 'u1',
        body: 'Hello',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deleted: false,
        author: { id: 'u1', name: 'Test', email: 'test@test.com', avatarUrl: null },
        reactions: [],
      },
    ],
  }),
  resolveThread: vi.fn().mockResolvedValue({ id: 't1', resolved: true }),
  addReply: vi.fn().mockResolvedValue({
    id: 'm2',
    threadId: 't1',
    authorId: 'u1',
    body: 'Reply text',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    author: { id: 'u1', name: 'Test', email: 'test@test.com', avatarUrl: null },
    reactions: [],
  }),
  toggleReaction: vi.fn().mockResolvedValue({
    toggled: true,
    reactions: [{ messageId: 'm1', emoji: '👍', userId: 'u1' }],
  }),
  deleteThread: vi.fn().mockResolvedValue(undefined),
  toggleSubscription: vi.fn().mockResolvedValue({ subscribed: true }),
}));

describe('commentStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    const state = useCommentStore.getState();
    state.stopPolling();
    useCommentStore.setState({
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
    });
  });

  it('startComposer sets the anchor', () => {
    const store = useCommentStore.getState();
    store.startComposer({ x: 100, y: 200 });
    expect(useCommentStore.getState().composerAnchor).toEqual({ x: 100, y: 200 });
  });

  it('cancelComposer clears the anchor', () => {
    const store = useCommentStore.getState();
    store.startComposer({ x: 100, y: 200 });
    store.cancelComposer();
    expect(useCommentStore.getState().composerAnchor).toBeNull();
  });

  it('submitThread creates thread and clears composer', async () => {
    const store = useCommentStore.getState();
    store.startComposer({ x: 50, y: 60 });
    await store.submitThread('b1', 'Hello');

    const state = useCommentStore.getState();
    expect(state.composerAnchor).toBeNull();
    expect(state.activeThreadId).toBe('new-thread');
    expect(state.threads['new-thread']).toBeDefined();
    expect(state.threads['new-thread'].messageCount).toBe(1);
  });

  it('draft management works correctly', () => {
    const store = useCommentStore.getState();

    store.setDraft('t1', 'draft text');
    expect(store.getDraft('t1')).toBe('draft text');

    store.clearDraft('t1');
    expect(useCommentStore.getState().getDraft('t1')).toBe('');
  });

  it('resolveThread applies optimistic update', async () => {
    useCommentStore.setState({
      threads: {
        t1: {
          id: 't1',
          boardId: 'b1',
          nodeId: null,
          anchorX: 100,
          anchorY: 200,
          resolved: false,
          resolvedAt: null,
          createdById: 'u1',
          createdBy: { id: 'u1', name: 'Test', email: 'test@test.com', avatarUrl: null },
          resolvedBy: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messageCount: 1,
          firstMessage: null,
          subscribed: true,
        },
      },
    });

    const store = useCommentStore.getState();
    // Optimistic: should update immediately
    store.resolveThread('b1', 't1', true);
    expect(useCommentStore.getState().threads['t1'].resolved).toBe(true);
  });

  it('deleteThread removes thread from store', async () => {
    useCommentStore.setState({
      threads: {
        t1: {
          id: 't1',
          boardId: 'b1',
          nodeId: null,
          anchorX: 100,
          anchorY: 200,
          resolved: false,
          resolvedAt: null,
          createdById: 'u1',
          createdBy: { id: 'u1', name: 'Test', email: 'test@test.com', avatarUrl: null },
          resolvedBy: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messageCount: 1,
          firstMessage: null,
          subscribed: true,
        },
      },
      activeThreadId: 't1',
    });

    const store = useCommentStore.getState();
    // Should optimistically remove
    await store.deleteThread('b1', 't1');
    const state = useCommentStore.getState();
    expect(state.threads['t1']).toBeUndefined();
    expect(state.activeThreadId).toBeNull();
  });

  it('loadThreads fetches and populates threads', async () => {
    const api = await import('../lib/commentApi');
    (api.fetchThreads as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      {
        id: 't1',
        boardId: 'b1',
        nodeId: null,
        anchorX: 100,
        anchorY: 200,
        resolved: false,
        resolvedAt: null,
        createdById: 'u1',
        createdBy: { id: 'u1', name: 'Test', email: 'test@test.com', avatarUrl: null },
        resolvedBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: 1,
        firstMessage: null,
        subscribed: true,
      },
    ]);

    await useCommentStore.getState().loadThreads('b1');
    const state = useCommentStore.getState();
    expect(state.threads['t1']).toBeDefined();
    expect(state.boardId).toBe('b1');
    expect(state.loading).toBe(false);
  });
});
