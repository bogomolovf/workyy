import { randomUUID } from 'crypto';
import Fastify, { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runsRoutes } from '../../routes/runs';

const mocks = vi.hoisted(() => ({
  queueRun: vi.fn(),
  enqueue: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock('../../container', () => ({
  container: {
    runService: { queueRun: mocks.queueRun },
    runProcessor: { enqueue: mocks.enqueue },
    prisma: { run: { findMany: mocks.findMany } },
  },
}));

describe('runsRoutes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    mocks.queueRun.mockReset();
    mocks.enqueue.mockReset();
    mocks.findMany.mockReset();
    await app.register(runsRoutes);
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 400 when idempotency header is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/runs',
      payload: { nodeId: randomUUID(), trigger: 'manual' },
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body).title).toBe('Missing idempotency key');
  });

  it('queues a run and returns 202', async () => {
    const runId = randomUUID();
    mocks.queueRun.mockResolvedValue({
      run: {
        id: runId,
        nodeId: randomUUID(),
        boardId: randomUUID(),
        status: 'queued',
        trigger: 'manual',
        startedAt: new Date().toISOString(),
        finishedAt: null,
      },
      duplicate: false,
      boardId: randomUUID(),
      workspaceId: randomUUID(),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/runs',
      headers: { 'idempotency-key': 'test-key' },
      payload: { nodeId: randomUUID(), trigger: 'manual' },
    });

    expect(response.statusCode).toBe(202);
    expect(mocks.enqueue).toHaveBeenCalledWith(runId);
    const body = JSON.parse(response.body);
    expect(body.runId).toBe(runId);
  });

  it('returns 409 for duplicate idempotency key', async () => {
    const runId = randomUUID();
    mocks.queueRun.mockResolvedValue({
      run: {
        id: runId,
        nodeId: randomUUID(),
        boardId: randomUUID(),
        status: 'queued',
        trigger: 'manual',
        startedAt: new Date().toISOString(),
        finishedAt: null,
      },
      duplicate: true,
      boardId: randomUUID(),
      workspaceId: randomUUID(),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/runs',
      headers: { 'idempotency-key': 'duplicate-key' },
      payload: { nodeId: randomUUID(), trigger: 'manual' },
    });

    expect(response.statusCode).toBe(409);
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it('returns 200 with paginated runs', async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: randomUUID(),
        nodeId: randomUUID(),
        boardId: randomUUID(),
        status: 'queued',
        trigger: 'manual',
        startedAt: new Date(),
        finishedAt: null,
      },
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/runs?limit=10',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.items).toHaveLength(1);
  });
});
