import { randomUUID } from 'crypto';
import Fastify, { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trackersRoutes } from '../../routes/trackers';

const mocks = vi.hoisted(() => ({
  trackerCreate: vi.fn(),
  trackerFindUnique: vi.fn(),
  trackerFindMany: vi.fn(),
  trackerUpdate: vi.fn(),
  trackerDelete: vi.fn(),
  columnCreate: vi.fn(),
  columnFindFirst: vi.fn(),
  columnFindMany: vi.fn(),
  columnUpdate: vi.fn(),
  columnDelete: vi.fn(),
  columnFindUnique: vi.fn(),
  taskCreate: vi.fn(),
  taskFindFirst: vi.fn(),
  taskFindUnique: vi.fn(),
  taskUpdate: vi.fn(),
  taskUpdateMany: vi.fn(),
  taskDelete: vi.fn(),
  activityCreate: vi.fn(),
  activityFindMany: vi.fn(),
  userWorkspaceRoleFindUnique: vi.fn(),
  userWorkspaceRoleFindMany: vi.fn(),
  recordAudit: vi.fn(),
}));

vi.mock('../../container', () => ({
  container: {
    prisma: {
      taskTracker: {
        create: mocks.trackerCreate,
        findUnique: mocks.trackerFindUnique,
        findMany: mocks.trackerFindMany,
        update: mocks.trackerUpdate,
        delete: mocks.trackerDelete,
      },
      taskColumn: {
        create: mocks.columnCreate,
        findFirst: mocks.columnFindFirst,
        findMany: mocks.columnFindMany,
        update: mocks.columnUpdate,
        delete: mocks.columnDelete,
        findUnique: mocks.columnFindUnique,
      },
      task: {
        create: mocks.taskCreate,
        findFirst: mocks.taskFindFirst,
        findUnique: mocks.taskFindUnique,
        update: mocks.taskUpdate,
        updateMany: mocks.taskUpdateMany,
        delete: mocks.taskDelete,
      },
      taskActivity: {
        create: mocks.activityCreate,
        findMany: mocks.activityFindMany,
      },
      userWorkspaceRole: {
        findUnique: mocks.userWorkspaceRoleFindUnique,
        findMany: mocks.userWorkspaceRoleFindMany,
      },
    },
    auditService: { record: mocks.recordAudit },
  },
}));

vi.mock('../../services/authorizationService', () => ({
  ensureWorkspaceAccess: vi.fn().mockResolvedValue({ ok: true, membership: { role: 'owner' } }),
  ensureTrackerAccess: vi.fn().mockResolvedValue({
    ok: true,
    tracker: { id: 'tracker-1', workspaceId: 'ws-1' },
    membership: { role: 'owner' },
  }),
}));

let app: FastifyInstance;
const userId = randomUUID();

beforeEach(async () => {
  app = Fastify();
  app.decorateRequest('user', null);
  app.decorate('authenticate', async (req: any) => {
    req.user = { userId };
  });
  await app.register(trackersRoutes);
  await app.ready();
});

afterEach(async () => {
  vi.clearAllMocks();
  await app.close();
});

describe('POST /trackers', () => {
  it('creates tracker with default columns', async () => {
    const tracker = {
      id: randomUUID(),
      workspaceId: 'ws-1',
      title: 'Test Tracker',
      description: null,
      backgroundUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
      columns: [
        { id: randomUUID(), title: 'Backlog', position: 1, isFinal: false },
        { id: randomUUID(), title: 'Done', position: 4, isFinal: true },
      ],
    };
    mocks.trackerCreate.mockResolvedValue(tracker);

    const res = await app.inject({
      method: 'POST',
      url: '/trackers',
      payload: { workspaceId: 'ws-1', title: 'Test Tracker' },
    });

    expect(res.statusCode).toBe(201);
    expect(mocks.trackerCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Test Tracker',
          columns: expect.objectContaining({
            create: expect.arrayContaining([
              expect.objectContaining({ title: 'Done', isFinal: true }),
            ]),
          }),
        }),
      }),
    );
  });
});

describe('GET /trackers/:trackerId', () => {
  it('returns tracker with columns and tasks', async () => {
    const tracker = {
      id: 'tracker-1',
      workspaceId: 'ws-1',
      title: 'My Tracker',
      columns: [],
      tasks: [],
      labels: [],
    };
    mocks.trackerFindUnique.mockResolvedValue(tracker);

    const res = await app.inject({
      method: 'GET',
      url: '/trackers/tracker-1',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.tracker.title).toBe('My Tracker');
  });
});

describe('POST /trackers/:trackerId/tasks', () => {
  it('creates task and records activity', async () => {
    const colId = randomUUID();
    mocks.taskFindFirst.mockResolvedValue(null);
    mocks.columnFindUnique.mockResolvedValue({ isFinal: false });
    mocks.taskCreate.mockResolvedValue({
      id: randomUUID(),
      trackerId: 'tracker-1',
      columnId: colId,
      title: 'New Task',
      position: 1,
      completedAt: null,
      labels: [],
      assignee: null,
      _count: { subtasks: 0, comments: 0 },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/trackers/tracker-1/tasks',
      payload: { title: 'New Task', columnId: colId },
    });

    expect(res.statusCode).toBe(201);
    expect(mocks.activityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'task.created' }),
      }),
    );
  });
});

describe('PATCH /trackers/:trackerId/tasks/:taskId (move)', () => {
  it('sets completedAt when moving to final column', async () => {
    const taskId = randomUUID();
    const finalColId = randomUUID();
    mocks.taskFindUnique.mockResolvedValue({
      columnId: 'old-col',
      assigneeId: null,
      priority: null,
      title: 'T',
    });
    mocks.columnFindUnique.mockResolvedValue({ isFinal: true, title: 'Done' });

    const moved = {
      id: taskId,
      columnId: finalColId,
      completedAt: new Date(),
      labels: [],
      assignee: null,
      _count: { subtasks: 0, comments: 0 },
    };
    mocks.taskUpdate.mockResolvedValue(moved);

    const res = await app.inject({
      method: 'PATCH',
      url: `/trackers/tracker-1/tasks/${taskId}`,
      payload: { columnId: finalColId },
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.taskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          completedAt: expect.any(Date),
        }),
      }),
    );
  });
});

describe('DELETE /trackers/:trackerId/columns/:columnId', () => {
  it('moves tasks to fallback column before deleting', async () => {
    const col1 = { id: 'col-1', position: 1 };
    const col2 = { id: 'col-2', position: 2 };
    mocks.columnFindMany.mockResolvedValue([col1, col2]);

    const res = await app.inject({
      method: 'DELETE',
      url: '/trackers/tracker-1/columns/col-2',
    });

    expect(res.statusCode).toBe(204);
    expect(mocks.taskUpdateMany).toHaveBeenCalledWith({
      where: { columnId: 'col-2' },
      data: { columnId: 'col-1' },
    });
    expect(mocks.columnDelete).toHaveBeenCalledWith({ where: { id: 'col-2' } });
  });

  it('rejects deleting last column', async () => {
    mocks.columnFindMany.mockResolvedValue([{ id: 'col-1', position: 1 }]);

    const res = await app.inject({
      method: 'DELETE',
      url: '/trackers/tracker-1/columns/col-1',
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('GET /trackers/:trackerId/activity', () => {
  it('returns activity list', async () => {
    mocks.activityFindMany.mockResolvedValue([
      { id: 'a1', type: 'task.created', createdAt: new Date(), actor: null },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/trackers/tracker-1/activity',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.activities).toHaveLength(1);
  });
});
