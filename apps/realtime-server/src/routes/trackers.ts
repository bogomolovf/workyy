import { Prisma } from '@prisma/client';
import { FastifyInstance } from 'fastify';
import { container } from '../container';
import { sendProblem } from '../lib/problem';
import { ensureTrackerAccess, ensureWorkspaceAccess } from '../services/authorizationService';
import {
  listTrackersQuerySchema,
  trackerParamsSchema,
  createTrackerBodySchema,
  updateTrackerBodySchema,
  columnParamsSchema,
  createColumnBodySchema,
  updateColumnBodySchema,
  reorderColumnsBodySchema,
  taskParamsSchema,
  createTaskBodySchema,
  updateTaskBodySchema,
  labelParamsSchema,
  taskLabelParamsSchema,
  createLabelBodySchema,
  updateLabelBodySchema,
  attachLabelBodySchema,
  createCommentBodySchema,
  activityQuerySchema,
} from '../validators/trackers';

async function recordActivity(params: {
  trackerId: string;
  taskId?: string;
  actorId?: string;
  type: string;
  payload?: Record<string, unknown>;
}) {
  try {
    await container.prisma.taskActivity.create({
      data: {
        trackerId: params.trackerId,
        taskId: params.taskId ?? null,
        actorId: params.actorId ?? null,
        type: params.type,
        payload: params.payload ?? {},
      },
    });
  } catch {
    // activity recording is best-effort; never block the main operation
  }
}

const DEFAULT_COLUMNS = [
  { title: 'Backlog', position: 1, isFinal: false },
  { title: 'To Do', position: 2, isFinal: false },
  { title: 'In Progress', position: 3, isFinal: false },
  { title: 'Done', position: 4, isFinal: true },
];

export async function trackersRoutes(app: FastifyInstance) {
  // ── Tracker CRUD ─────────────────────────────────────────────────

  app.get('/trackers', { preValidation: [app.authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    const parsed = listTrackersQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return sendProblem(reply, {
        title: 'Validation error',
        status: 422,
        detail: parsed.error.message,
      });
    }

    const { workspaceId } = parsed.data;

    if (workspaceId) {
      const access = await ensureWorkspaceAccess({ userId, workspaceId });
      if (!access.ok) {
        return sendProblem(reply, {
          title: 'Forbidden',
          status: 403,
          detail: 'Access denied to this workspace',
        });
      }
    }

    const userWorkspaces = await container.prisma.userWorkspaceRole.findMany({
      where: { userId },
      select: { workspaceId: true },
    });
    const wsIds = userWorkspaces.map((uw) => uw.workspaceId);

    const trackers = await container.prisma.taskTracker.findMany({
      where: { workspaceId: workspaceId ? workspaceId : { in: wsIds } },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { tasks: true, columns: true } },
      },
    });

    return reply.send({
      trackers: trackers.map((t) => ({
        id: t.id,
        workspaceId: t.workspaceId,
        title: t.title,
        description: t.description,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        stats: { tasks: t._count.tasks, columns: t._count.columns },
      })),
    });
  });

  app.post('/trackers', { preValidation: [app.authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    const parsed = createTrackerBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return sendProblem(reply, {
        title: 'Validation error',
        status: 422,
        detail: parsed.error.message,
        errors: parsed.error.flatten(),
      });
    }
    const body = parsed.data;

    const access = await ensureWorkspaceAccess({
      userId,
      workspaceId: body.workspaceId,
      requiredRoles: ['owner', 'editor'],
    });
    if (!access.ok) {
      return sendProblem(reply, {
        title: 'Forbidden',
        status: access.status,
        detail: access.reason,
      });
    }

    try {
      const tracker = await container.prisma.taskTracker.create({
        data: {
          workspaceId: body.workspaceId,
          title: body.title,
          description: body.description,
          createdBy: userId,
          columns: {
            create: DEFAULT_COLUMNS,
          },
        },
        include: { columns: { orderBy: { position: 'asc' } } },
      });

      await container.auditService.record({
        type: 'tracker.created',
        workspaceId: tracker.workspaceId,
        payload: { trackerId: tracker.id, title: tracker.title },
      });

      return reply.code(201).send(tracker);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return sendProblem(reply, {
          title: 'Tracker title already exists',
          status: 409,
          detail: 'Tracker title must be unique within a workspace',
        });
      }
      request.log.error({ err: error }, 'Failed to create tracker');
      return sendProblem(reply, {
        title: 'Internal server error',
        status: 500,
        detail: 'Unable to create tracker',
      });
    }
  });

  app.get('/trackers/:trackerId', { preValidation: [app.authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    const parsed = trackerParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return sendProblem(reply, {
        title: 'Validation error',
        status: 422,
        detail: parsed.error.message,
      });
    }

    const access = await ensureTrackerAccess({ userId, trackerId: parsed.data.trackerId });
    if (!access.ok) {
      return sendProblem(reply, {
        title: access.status === 404 ? 'Tracker not found' : 'Forbidden',
        status: access.status,
        detail: access.reason,
      });
    }

    const tracker = await container.prisma.taskTracker.findUnique({
      where: { id: parsed.data.trackerId },
      include: {
        columns: { orderBy: { position: 'asc' } },
        tasks: {
          where: { parentTaskId: null },
          orderBy: { position: 'asc' },
          include: {
            labels: { include: { label: true } },
            assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
            _count: { select: { subtasks: true, comments: true } },
          },
        },
        labels: { orderBy: { name: 'asc' } },
      },
    });

    if (!tracker) {
      return sendProblem(reply, {
        title: 'Tracker not found',
        status: 404,
        detail: 'Tracker does not exist',
      });
    }

    return reply.send({ tracker });
  });

  app.patch(
    '/trackers/:trackerId',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const parsedParams = trackerParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsedParams.error.message,
        });
      }
      const parsedBody = updateTrackerBodySchema.safeParse(request.body);
      if (!parsedBody.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsedBody.error.message,
        });
      }

      const access = await ensureTrackerAccess({
        userId,
        trackerId: parsedParams.data.trackerId,
        requiredRoles: ['owner', 'editor'],
      });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Tracker not found' : 'Forbidden',
          status: access.status,
          detail: access.reason,
        });
      }

      const data: Prisma.TaskTrackerUpdateInput = {};
      if (parsedBody.data.title !== undefined) data.title = parsedBody.data.title;
      if (parsedBody.data.description !== undefined) data.description = parsedBody.data.description;
      if (parsedBody.data.backgroundUrl !== undefined)
        data.backgroundUrl = parsedBody.data.backgroundUrl;

      const updated = await container.prisma.taskTracker.update({
        where: { id: parsedParams.data.trackerId },
        data,
      });

      return reply.send({ tracker: updated });
    },
  );

  app.delete(
    '/trackers/:trackerId',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const parsed = trackerParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsed.error.message,
        });
      }

      const access = await ensureTrackerAccess({
        userId,
        trackerId: parsed.data.trackerId,
        requiredRoles: ['owner'],
      });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Tracker not found' : 'Forbidden',
          status: access.status,
          detail: access.reason,
        });
      }

      await container.prisma.taskTracker.delete({ where: { id: parsed.data.trackerId } });

      await container.auditService.record({
        type: 'tracker.deleted',
        workspaceId: access.tracker!.workspaceId,
        payload: { trackerId: parsed.data.trackerId },
      });

      return reply.code(204).send();
    },
  );

  // ── Columns ──────────────────────────────────────────────────────

  app.post(
    '/trackers/:trackerId/columns',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const parsedParams = trackerParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsedParams.error.message,
        });
      }
      const parsedBody = createColumnBodySchema.safeParse(request.body);
      if (!parsedBody.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsedBody.error.message,
        });
      }

      const access = await ensureTrackerAccess({
        userId,
        trackerId: parsedParams.data.trackerId,
        requiredRoles: ['owner', 'editor'],
      });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Tracker not found' : 'Forbidden',
          status: access.status,
          detail: access.reason,
        });
      }

      const lastCol = await container.prisma.taskColumn.findFirst({
        where: { trackerId: parsedParams.data.trackerId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });

      const column = await container.prisma.taskColumn.create({
        data: {
          trackerId: parsedParams.data.trackerId,
          title: parsedBody.data.title,
          position: (lastCol?.position ?? 0) + 1,
          isFinal: parsedBody.data.isFinal ?? false,
        },
      });

      return reply.code(201).send({ column });
    },
  );

  app.patch(
    '/trackers/:trackerId/columns/:columnId',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const parsedParams = columnParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsedParams.error.message,
        });
      }
      const parsedBody = updateColumnBodySchema.safeParse(request.body);
      if (!parsedBody.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsedBody.error.message,
        });
      }

      const access = await ensureTrackerAccess({
        userId,
        trackerId: parsedParams.data.trackerId,
        requiredRoles: ['owner', 'editor'],
      });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Tracker not found' : 'Forbidden',
          status: access.status,
          detail: access.reason,
        });
      }

      const data: Prisma.TaskColumnUpdateInput = {};
      if (parsedBody.data.title !== undefined) data.title = parsedBody.data.title;
      if (parsedBody.data.position !== undefined) data.position = parsedBody.data.position;
      if (parsedBody.data.isFinal !== undefined) data.isFinal = parsedBody.data.isFinal;

      const column = await container.prisma.taskColumn.update({
        where: { id: parsedParams.data.columnId },
        data,
      });

      return reply.send({ column });
    },
  );

  app.delete(
    '/trackers/:trackerId/columns/:columnId',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const parsedParams = columnParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsedParams.error.message,
        });
      }

      const access = await ensureTrackerAccess({
        userId,
        trackerId: parsedParams.data.trackerId,
        requiredRoles: ['owner', 'editor'],
      });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Tracker not found' : 'Forbidden',
          status: access.status,
          detail: access.reason,
        });
      }

      const columns = await container.prisma.taskColumn.findMany({
        where: { trackerId: parsedParams.data.trackerId },
        orderBy: { position: 'asc' },
      });

      if (columns.length <= 1) {
        return sendProblem(reply, {
          title: 'Cannot delete last column',
          status: 400,
          detail: 'A tracker must have at least one column',
        });
      }

      const fallback = columns.find((c) => c.id !== parsedParams.data.columnId);
      if (!fallback) {
        return sendProblem(reply, {
          title: 'No fallback column',
          status: 400,
          detail: 'Cannot determine fallback column',
        });
      }

      await container.prisma.task.updateMany({
        where: { columnId: parsedParams.data.columnId },
        data: { columnId: fallback.id },
      });

      await container.prisma.taskColumn.delete({ where: { id: parsedParams.data.columnId } });

      return reply.code(204).send();
    },
  );

  app.put(
    '/trackers/:trackerId/columns/reorder',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const parsedParams = trackerParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsedParams.error.message,
        });
      }
      const parsedBody = reorderColumnsBodySchema.safeParse(request.body);
      if (!parsedBody.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsedBody.error.message,
        });
      }

      const access = await ensureTrackerAccess({
        userId,
        trackerId: parsedParams.data.trackerId,
        requiredRoles: ['owner', 'editor'],
      });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Tracker not found' : 'Forbidden',
          status: access.status,
          detail: access.reason,
        });
      }

      for (const col of parsedBody.data.columns) {
        await container.prisma.taskColumn.update({
          where: { id: col.id },
          data: { position: col.position },
        });
      }

      return reply.send({ ok: true });
    },
  );

  // ── Tasks ────────────────────────────────────────────────────────

  app.post(
    '/trackers/:trackerId/tasks',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const parsedParams = trackerParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsedParams.error.message,
        });
      }
      const parsedBody = createTaskBodySchema.safeParse(request.body);
      if (!parsedBody.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsedBody.error.message,
          errors: parsedBody.error.flatten(),
        });
      }

      const access = await ensureTrackerAccess({
        userId,
        trackerId: parsedParams.data.trackerId,
        requiredRoles: ['owner', 'editor'],
      });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Tracker not found' : 'Forbidden',
          status: access.status,
          detail: access.reason,
        });
      }

      const lastTask = await container.prisma.task.findFirst({
        where: { trackerId: parsedParams.data.trackerId, columnId: parsedBody.data.columnId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });

      const column = await container.prisma.taskColumn.findUnique({
        where: { id: parsedBody.data.columnId },
        select: { isFinal: true },
      });

      const task = await container.prisma.task.create({
        data: {
          trackerId: parsedParams.data.trackerId,
          columnId: parsedBody.data.columnId,
          title: parsedBody.data.title,
          description: parsedBody.data.description,
          parentTaskId: parsedBody.data.parentTaskId ?? undefined,
          assigneeId: parsedBody.data.assigneeId ?? undefined,
          priority: parsedBody.data.priority ?? undefined,
          dueDate: parsedBody.data.dueDate ? new Date(parsedBody.data.dueDate) : undefined,
          position: (lastTask?.position ?? 0) + 1,
          completedAt: column?.isFinal ? new Date() : undefined,
          createdBy: userId,
        },
        include: {
          labels: { include: { label: true } },
          assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
          _count: { select: { subtasks: true, comments: true } },
        },
      });

      await recordActivity({
        trackerId: parsedParams.data.trackerId,
        taskId: task.id,
        actorId: userId,
        type: parsedBody.data.parentTaskId ? 'subtask.created' : 'task.created',
        payload: { title: task.title },
      });

      return reply.code(201).send({ task });
    },
  );

  app.get(
    '/trackers/:trackerId/tasks/:taskId',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const parsed = taskParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsed.error.message,
        });
      }

      const access = await ensureTrackerAccess({ userId, trackerId: parsed.data.trackerId });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Tracker not found' : 'Forbidden',
          status: access.status,
          detail: access.reason,
        });
      }

      const task = await container.prisma.task.findUnique({
        where: { id: parsed.data.taskId },
        include: {
          labels: { include: { label: true } },
          assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
          subtasks: {
            orderBy: { position: 'asc' },
            include: {
              assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
              _count: { select: { subtasks: true, comments: true } },
            },
          },
          comments: {
            orderBy: { createdAt: 'asc' },
            include: {
              author: { select: { id: true, name: true, email: true, avatarUrl: true } },
            },
          },
          column: { select: { id: true, title: true, isFinal: true } },
        },
      });

      if (!task) {
        return sendProblem(reply, {
          title: 'Task not found',
          status: 404,
          detail: 'Task does not exist',
        });
      }

      return reply.send({ task });
    },
  );

  app.patch(
    '/trackers/:trackerId/tasks/:taskId',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const parsedParams = taskParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsedParams.error.message,
        });
      }
      const parsedBody = updateTaskBodySchema.safeParse(request.body);
      if (!parsedBody.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsedBody.error.message,
        });
      }

      const access = await ensureTrackerAccess({
        userId,
        trackerId: parsedParams.data.trackerId,
        requiredRoles: ['owner', 'editor'],
      });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Tracker not found' : 'Forbidden',
          status: access.status,
          detail: access.reason,
        });
      }

      const data: Prisma.TaskUpdateInput = {};
      const body = parsedBody.data;
      if (body.title !== undefined) data.title = body.title;
      if (body.description !== undefined) data.description = body.description;
      if (body.assigneeId !== undefined)
        data.assignee = body.assigneeId
          ? { connect: { id: body.assigneeId } }
          : { disconnect: true };
      if (body.priority !== undefined) data.priority = body.priority;
      if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
      if (body.position !== undefined) data.position = body.position;

      const oldTask = await container.prisma.task.findUnique({
        where: { id: parsedParams.data.taskId },
        select: { columnId: true, assigneeId: true, priority: true, title: true },
      });

      if (body.columnId !== undefined) {
        data.column = { connect: { id: body.columnId } };
        const col = await container.prisma.taskColumn.findUnique({
          where: { id: body.columnId },
          select: { isFinal: true, title: true },
        });
        if (col?.isFinal) {
          data.completedAt = new Date();
        } else {
          data.completedAt = null;
        }
        if (oldTask && body.columnId !== oldTask.columnId) {
          const oldCol = await container.prisma.taskColumn.findUnique({
            where: { id: oldTask.columnId },
            select: { title: true },
          });
          await recordActivity({
            trackerId: parsedParams.data.trackerId,
            taskId: parsedParams.data.taskId,
            actorId: userId,
            type: 'task.moved',
            payload: { from: oldCol?.title, to: col?.title },
          });
        }
      }

      if (body.assigneeId !== undefined && oldTask && body.assigneeId !== oldTask.assigneeId) {
        await recordActivity({
          trackerId: parsedParams.data.trackerId,
          taskId: parsedParams.data.taskId,
          actorId: userId,
          type: 'task.assignee_changed',
          payload: { assigneeId: body.assigneeId },
        });
      }

      if (body.priority !== undefined && oldTask && body.priority !== oldTask.priority) {
        await recordActivity({
          trackerId: parsedParams.data.trackerId,
          taskId: parsedParams.data.taskId,
          actorId: userId,
          type: 'task.priority_changed',
          payload: { from: oldTask.priority, to: body.priority },
        });
      }

      const task = await container.prisma.task.update({
        where: { id: parsedParams.data.taskId },
        data,
        include: {
          labels: { include: { label: true } },
          assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
          _count: { select: { subtasks: true, comments: true } },
        },
      });

      return reply.send({ task });
    },
  );

  app.delete(
    '/trackers/:trackerId/tasks/:taskId',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const parsed = taskParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsed.error.message,
        });
      }

      const access = await ensureTrackerAccess({
        userId,
        trackerId: parsed.data.trackerId,
        requiredRoles: ['owner', 'editor'],
      });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Tracker not found' : 'Forbidden',
          status: access.status,
          detail: access.reason,
        });
      }

      const deletedTask = await container.prisma.task.findUnique({
        where: { id: parsed.data.taskId },
        select: { title: true },
      });
      await container.prisma.task.delete({ where: { id: parsed.data.taskId } });
      await recordActivity({
        trackerId: parsed.data.trackerId,
        actorId: userId,
        type: 'task.deleted',
        payload: { title: deletedTask?.title },
      });
      return reply.code(204).send();
    },
  );

  // ── Labels ───────────────────────────────────────────────────────

  app.get(
    '/trackers/:trackerId/labels',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const parsed = trackerParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsed.error.message,
        });
      }

      const access = await ensureTrackerAccess({ userId, trackerId: parsed.data.trackerId });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Tracker not found' : 'Forbidden',
          status: access.status,
          detail: access.reason,
        });
      }

      const labels = await container.prisma.taskLabel.findMany({
        where: { trackerId: parsed.data.trackerId },
        orderBy: { name: 'asc' },
      });

      return reply.send({ labels });
    },
  );

  app.post(
    '/trackers/:trackerId/labels',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const parsedParams = trackerParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsedParams.error.message,
        });
      }
      const parsedBody = createLabelBodySchema.safeParse(request.body);
      if (!parsedBody.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsedBody.error.message,
        });
      }

      const access = await ensureTrackerAccess({
        userId,
        trackerId: parsedParams.data.trackerId,
        requiredRoles: ['owner', 'editor'],
      });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Tracker not found' : 'Forbidden',
          status: access.status,
          detail: access.reason,
        });
      }

      try {
        const label = await container.prisma.taskLabel.create({
          data: {
            trackerId: parsedParams.data.trackerId,
            name: parsedBody.data.name,
            color: parsedBody.data.color,
          },
        });
        return reply.code(201).send({ label });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          return sendProblem(reply, {
            title: 'Label already exists',
            status: 409,
            detail: 'A label with this name already exists in the tracker',
          });
        }
        throw error;
      }
    },
  );

  app.patch(
    '/trackers/:trackerId/labels/:labelId',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const parsedParams = labelParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsedParams.error.message,
        });
      }
      const parsedBody = updateLabelBodySchema.safeParse(request.body);
      if (!parsedBody.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsedBody.error.message,
        });
      }

      const access = await ensureTrackerAccess({
        userId,
        trackerId: parsedParams.data.trackerId,
        requiredRoles: ['owner', 'editor'],
      });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Tracker not found' : 'Forbidden',
          status: access.status,
          detail: access.reason,
        });
      }

      const data: Prisma.TaskLabelUpdateInput = {};
      if (parsedBody.data.name !== undefined) data.name = parsedBody.data.name;
      if (parsedBody.data.color !== undefined) data.color = parsedBody.data.color;

      const label = await container.prisma.taskLabel.update({
        where: { id: parsedParams.data.labelId },
        data,
      });
      return reply.send({ label });
    },
  );

  app.delete(
    '/trackers/:trackerId/labels/:labelId',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const parsedParams = labelParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsedParams.error.message,
        });
      }

      const access = await ensureTrackerAccess({
        userId,
        trackerId: parsedParams.data.trackerId,
        requiredRoles: ['owner', 'editor'],
      });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Tracker not found' : 'Forbidden',
          status: access.status,
          detail: access.reason,
        });
      }

      await container.prisma.taskLabel.delete({ where: { id: parsedParams.data.labelId } });
      return reply.code(204).send();
    },
  );

  app.post(
    '/trackers/:trackerId/tasks/:taskId/labels',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const parsedParams = taskParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsedParams.error.message,
        });
      }
      const parsedBody = attachLabelBodySchema.safeParse(request.body);
      if (!parsedBody.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsedBody.error.message,
        });
      }

      const access = await ensureTrackerAccess({
        userId,
        trackerId: parsedParams.data.trackerId,
        requiredRoles: ['owner', 'editor'],
      });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Tracker not found' : 'Forbidden',
          status: access.status,
          detail: access.reason,
        });
      }

      try {
        await container.prisma.taskLabelOnTask.create({
          data: { taskId: parsedParams.data.taskId, labelId: parsedBody.data.labelId },
        });
        const label = await container.prisma.taskLabel.findUnique({
          where: { id: parsedBody.data.labelId },
          select: { name: true },
        });
        await recordActivity({
          trackerId: parsedParams.data.trackerId,
          taskId: parsedParams.data.taskId,
          actorId: userId,
          type: 'label.added',
          payload: { labelName: label?.name },
        });
        return reply.code(201).send({ ok: true });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          return reply.send({ ok: true });
        }
        throw error;
      }
    },
  );

  app.delete(
    '/trackers/:trackerId/tasks/:taskId/labels/:labelId',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const parsedParams = taskLabelParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsedParams.error.message,
        });
      }

      const access = await ensureTrackerAccess({
        userId,
        trackerId: parsedParams.data.trackerId,
        requiredRoles: ['owner', 'editor'],
      });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Tracker not found' : 'Forbidden',
          status: access.status,
          detail: access.reason,
        });
      }

      await container.prisma.taskLabelOnTask.deleteMany({
        where: { taskId: parsedParams.data.taskId, labelId: parsedParams.data.labelId },
      });

      return reply.code(204).send();
    },
  );

  // ── Comments ─────────────────────────────────────────────────────

  app.get(
    '/trackers/:trackerId/tasks/:taskId/comments',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const parsed = taskParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsed.error.message,
        });
      }

      const access = await ensureTrackerAccess({ userId, trackerId: parsed.data.trackerId });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Tracker not found' : 'Forbidden',
          status: access.status,
          detail: access.reason,
        });
      }

      const comments = await container.prisma.taskComment.findMany({
        where: { taskId: parsed.data.taskId },
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      });

      return reply.send({ comments });
    },
  );

  app.post(
    '/trackers/:trackerId/tasks/:taskId/comments',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const parsedParams = taskParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsedParams.error.message,
        });
      }
      const parsedBody = createCommentBodySchema.safeParse(request.body);
      if (!parsedBody.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsedBody.error.message,
        });
      }

      const access = await ensureTrackerAccess({ userId, trackerId: parsedParams.data.trackerId });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Tracker not found' : 'Forbidden',
          status: access.status,
          detail: access.reason,
        });
      }

      const comment = await container.prisma.taskComment.create({
        data: {
          taskId: parsedParams.data.taskId,
          authorId: userId,
          body: parsedBody.data.body,
        },
        include: {
          author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      });

      await recordActivity({
        trackerId: parsedParams.data.trackerId,
        taskId: parsedParams.data.taskId,
        actorId: userId,
        type: 'comment.added',
      });

      return reply.code(201).send({ comment });
    },
  );

  // ── Activity ────────────────────────────────────────────────────────

  app.get(
    '/trackers/:trackerId/activity',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const parsedParams = trackerParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsedParams.error.message,
        });
      }
      const parsedQuery = activityQuerySchema.safeParse(request.query);
      if (!parsedQuery.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsedQuery.error.message,
        });
      }

      const access = await ensureTrackerAccess({ userId, trackerId: parsedParams.data.trackerId });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Tracker not found' : 'Forbidden',
          status: access.status,
          detail: access.reason,
        });
      }

      const { cursor, limit } = parsedQuery.data;
      const activities = await container.prisma.taskActivity.findMany({
        where: {
          trackerId: parsedParams.data.trackerId,
          ...(cursor ? { id: { lt: cursor } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          actor: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      });

      return reply.send({ activities });
    },
  );

  app.get(
    '/trackers/:trackerId/tasks/:taskId/activity',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const parsedParams = taskParamsSchema.safeParse(request.params);
      if (!parsedParams.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsedParams.error.message,
        });
      }
      const parsedQuery = activityQuerySchema.safeParse(request.query);
      if (!parsedQuery.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsedQuery.error.message,
        });
      }

      const access = await ensureTrackerAccess({ userId, trackerId: parsedParams.data.trackerId });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Tracker not found' : 'Forbidden',
          status: access.status,
          detail: access.reason,
        });
      }

      const { cursor, limit } = parsedQuery.data;
      const activities = await container.prisma.taskActivity.findMany({
        where: {
          taskId: parsedParams.data.taskId,
          ...(cursor ? { id: { lt: cursor } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          actor: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      });

      return reply.send({ activities });
    },
  );
}
