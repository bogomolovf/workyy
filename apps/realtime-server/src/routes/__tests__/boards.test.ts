import { randomUUID } from 'crypto';
import Fastify, { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { boardsRoutes } from '../../routes/boards';

const mocks = vi.hoisted(() => ({
  workspaceFindUnique: vi.fn(),
  boardCreate: vi.fn(),
  boardFindUnique: vi.fn(),
  boardFindMany: vi.fn(),
  boardUpdate: vi.fn(),
  nodeFindMany: vi.fn(),
  nodeDeleteMany: vi.fn(),
  nodeUpsert: vi.fn(),
  edgeFindMany: vi.fn(),
  edgeDeleteMany: vi.fn(),
  edgeUpsert: vi.fn(),
  recordAudit: vi.fn(),
}));

vi.mock('../../container', () => ({
  container: {
    prisma: {
      workspace: { findUnique: mocks.workspaceFindUnique },
      board: {
        create: mocks.boardCreate,
        findUnique: mocks.boardFindUnique,
        findMany: mocks.boardFindMany,
        update: mocks.boardUpdate,
      },
      node: {
        findMany: mocks.nodeFindMany,
        deleteMany: mocks.nodeDeleteMany,
        upsert: mocks.nodeUpsert,
      },
      edge: {
        findMany: mocks.edgeFindMany,
        deleteMany: mocks.edgeDeleteMany,
        upsert: mocks.edgeUpsert,
      },
    },
    auditService: { record: mocks.recordAudit },
  },
}));

describe('boardsRoutes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    mocks.workspaceFindUnique.mockReset();
    mocks.boardCreate.mockReset();
    mocks.boardFindUnique.mockReset();
    mocks.boardFindMany.mockReset();
    mocks.boardUpdate.mockReset();
    mocks.nodeFindMany.mockReset();
    mocks.nodeDeleteMany.mockReset();
    mocks.nodeUpsert.mockReset();
    mocks.edgeFindMany.mockReset();
    mocks.edgeDeleteMany.mockReset();
    mocks.edgeUpsert.mockReset();
    mocks.recordAudit.mockReset();
    await app.register(boardsRoutes);
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 422 for invalid workspaceId query', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/boards?workspaceId=invalid',
    });

    expect(response.statusCode).toBe(422);
    expect(mocks.boardFindMany).not.toHaveBeenCalled();
  });

  it('returns list of boards', async () => {
    const now = new Date();
    const workspaceId = randomUUID();
    const boardId = randomUUID();
    mocks.boardFindMany.mockResolvedValue([
      {
        id: boardId,
        workspaceId,
        title: 'Demo Board',
        description: null,
        createdAt: now,
        updatedAt: now,
        _count: { nodes: 2, edges: 1 },
      },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/boards',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.boards).toHaveLength(1);
    expect(body.boards[0]).toMatchObject({
      id: boardId,
      workspaceId,
      title: 'Demo Board',
      stats: { nodes: 2, edges: 1 },
    });
    expect(mocks.boardFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { updatedAt: 'desc' },
      }),
    );
  });

  it('filters boards by workspaceId when provided', async () => {
    const workspaceId = randomUUID();
    mocks.boardFindMany.mockResolvedValue([]);

    const response = await app.inject({
      method: 'GET',
      url: `/boards?workspaceId=${workspaceId}`,
    });

    expect(response.statusCode).toBe(200);
    expect(mocks.boardFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId },
      }),
    );
  });

  it('returns 404 if workspace missing', async () => {
    mocks.workspaceFindUnique.mockResolvedValue(null);
    const response = await app.inject({
      method: 'POST',
      url: '/boards',
      payload: {
        workspaceId: randomUUID(),
        title: 'Demo',
      },
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns board payload on success', async () => {
    const workspaceId = randomUUID();
    const boardId = randomUUID();
    mocks.workspaceFindUnique.mockResolvedValue({ id: workspaceId });
    mocks.boardCreate.mockResolvedValue({
      id: boardId,
      workspaceId,
      title: 'Demo Board',
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/boards',
      payload: {
        workspaceId,
        title: 'Demo Board',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.id).toBe(boardId);
    expect(mocks.recordAudit).toHaveBeenCalled();
  });

  it('returns 404 when updating nodes for missing board', async () => {
    mocks.boardFindUnique.mockResolvedValue(null);

    const response = await app.inject({
      method: 'PUT',
      url: `/boards/${randomUUID()}/nodes`,
      payload: { nodes: [], edges: [] },
    });

    expect(response.statusCode).toBe(404);
    expect(mocks.nodeUpsert).not.toHaveBeenCalled();
    expect(mocks.edgeUpsert).not.toHaveBeenCalled();
  });

  it('persists nodes and edges', async () => {
    const boardId = randomUUID();
    const workspaceId = randomUUID();
    const nodeId = randomUUID();
    const edgeId = randomUUID();

    mocks.boardFindUnique.mockResolvedValue({ id: boardId, workspaceId });
    mocks.nodeFindMany.mockResolvedValue([{ id: randomUUID() }]); // existing node to delete
    mocks.edgeFindMany.mockResolvedValue([{ id: randomUUID() }]);
    mocks.nodeDeleteMany.mockResolvedValue({ count: 1 });
    mocks.edgeDeleteMany.mockResolvedValue({ count: 1 });
    mocks.nodeUpsert.mockResolvedValue({});
    mocks.edgeUpsert.mockResolvedValue({});
    mocks.boardUpdate.mockResolvedValue({});

    const payload = {
      nodes: [
        {
          id: nodeId,
          type: 'sql',
          position: { x: 120, y: 240 },
          payload: { sql: 'SELECT 1;' },
        },
      ],
      edges: [
        {
          id: edgeId,
          sourceId: nodeId,
          targetId: nodeId,
          metadata: { kind: 'self' },
        },
      ],
    };

    const response = await app.inject({
      method: 'PUT',
      url: `/boards/${boardId}/nodes`,
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(mocks.nodeDeleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        boardId,
      }),
    });
    expect(mocks.nodeUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          id: nodeId,
          boardId,
          payload: payload.nodes[0].payload,
        }),
      }),
    );
    expect(mocks.edgeDeleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        boardId,
      }),
    });
    expect(mocks.edgeUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          id: edgeId,
          boardId,
          sourceId: nodeId,
          targetId: nodeId,
          metadata: payload.edges[0].metadata,
        }),
      }),
    );
    expect(mocks.boardUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: boardId },
      }),
    );
  });
});

