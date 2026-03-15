import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// Mock container and auth before importing routes
vi.mock('../../container', () => {
  const mockPrisma: Record<string, unknown> = {
    commentThread: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    commentMessage: {
      create: vi.fn(),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    },
    messageReaction: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    threadSubscription: {
      create: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
  mockPrisma.$transaction = vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma));
  return { container: { prisma: mockPrisma } };
});

vi.mock('../../services/authorizationService', () => ({
  ensureBoardAccess: vi.fn().mockResolvedValue({
    ok: true,
    board: { id: 'board-1', workspaceId: 'ws-1' },
    membership: { role: 'owner' },
  }),
}));

describe('Comment validators', () => {
  it('createThreadBodySchema validates correctly', async () => {
    const { createThreadBodySchema } = await import('../../validators/comments');

    const valid = createThreadBodySchema.safeParse({
      body: 'Hello world',
      anchorX: 100.5,
      anchorY: 200.3,
      nodeId: null,
    });
    expect(valid.success).toBe(true);

    const invalid = createThreadBodySchema.safeParse({
      body: '',
      anchorX: 100,
      anchorY: 200,
    });
    expect(invalid.success).toBe(false);
  });

  it('resolveThreadBodySchema validates correctly', async () => {
    const { resolveThreadBodySchema } = await import('../../validators/comments');

    expect(resolveThreadBodySchema.safeParse({ resolved: true }).success).toBe(true);
    expect(resolveThreadBodySchema.safeParse({ resolved: 'yes' }).success).toBe(false);
  });

  it('toggleReactionBodySchema validates correctly', async () => {
    const { toggleReactionBodySchema } = await import('../../validators/comments');

    expect(toggleReactionBodySchema.safeParse({ emoji: '👍' }).success).toBe(true);
    expect(toggleReactionBodySchema.safeParse({ emoji: '' }).success).toBe(false);
  });

  it('listThreadsQuerySchema transforms resolved filter', async () => {
    const { listThreadsQuerySchema } = await import('../../validators/comments');

    const r1 = listThreadsQuerySchema.safeParse({ resolved: 'true' });
    expect(r1.success).toBe(true);
    if (r1.success) expect(r1.data.resolved).toBe(true);

    const r2 = listThreadsQuerySchema.safeParse({ resolved: 'false' });
    expect(r2.success).toBe(true);
    if (r2.success) expect(r2.data.resolved).toBe(false);

    const r3 = listThreadsQuerySchema.safeParse({});
    expect(r3.success).toBe(true);
    if (r3.success) expect(r3.data.resolved).toBeUndefined();
  });

  it('editMessageBodySchema validates correctly', async () => {
    const { editMessageBodySchema } = await import('../../validators/comments');

    expect(editMessageBodySchema.safeParse({ body: 'Updated text' }).success).toBe(true);
    expect(editMessageBodySchema.safeParse({ body: '' }).success).toBe(false);
  });

  it('toggleSubscriptionBodySchema validates correctly', async () => {
    const { toggleSubscriptionBodySchema } = await import('../../validators/comments');

    expect(toggleSubscriptionBodySchema.safeParse({ subscribed: true }).success).toBe(true);
    expect(toggleSubscriptionBodySchema.safeParse({ subscribed: false }).success).toBe(true);
    expect(toggleSubscriptionBodySchema.safeParse({ subscribed: 'yes' }).success).toBe(false);
  });
});

describe('Comment route param validators', () => {
  it('boardThreadParamsSchema validates UUID', async () => {
    const { boardThreadParamsSchema } = await import('../../validators/comments');

    const valid = boardThreadParamsSchema.safeParse({
      boardId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(valid.success).toBe(true);

    const invalid = boardThreadParamsSchema.safeParse({ boardId: 'not-a-uuid' });
    expect(invalid.success).toBe(false);
  });

  it('messageParamsSchema validates all three UUIDs', async () => {
    const { messageParamsSchema } = await import('../../validators/comments');

    const valid = messageParamsSchema.safeParse({
      boardId: '550e8400-e29b-41d4-a716-446655440000',
      threadId: '550e8400-e29b-41d4-a716-446655440001',
      messageId: '550e8400-e29b-41d4-a716-446655440002',
    });
    expect(valid.success).toBe(true);

    const partial = messageParamsSchema.safeParse({
      boardId: '550e8400-e29b-41d4-a716-446655440000',
      threadId: '550e8400-e29b-41d4-a716-446655440001',
    });
    expect(partial.success).toBe(false);
  });
});
