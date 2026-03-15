import { FastifyInstance } from 'fastify';
import { container } from '../container';
import { sendProblem } from '../lib/problem';
import { ensureBoardAccess } from '../services/authorizationService';
import {
  boardThreadParamsSchema,
  threadParamsSchema,
  messageParamsSchema,
  createThreadBodySchema,
  listThreadsQuerySchema,
  resolveThreadBodySchema,
  moveThreadBodySchema,
  addReplyBodySchema,
  editMessageBodySchema,
  toggleReactionBodySchema,
  toggleSubscriptionBodySchema,
} from '../validators/comments';

export async function commentsRoutes(app: FastifyInstance) {
  // ─── List threads for a board ───────────────────────────────────────
  app.get(
    '/boards/:boardId/threads',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const params = boardThreadParamsSchema.safeParse(request.params);
      if (!params.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: params.error.message,
        });
      }
      const query = listThreadsQuerySchema.safeParse(request.query);
      if (!query.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: query.error.message,
        });
      }

      const access = await ensureBoardAccess({ userId, boardId: params.data.boardId });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Board not found' : 'Forbidden',
          status: access.status,
          detail: access.reason,
        });
      }

      const where: Record<string, unknown> = { boardId: params.data.boardId };
      if (query.data.resolved !== undefined) {
        where.resolved = query.data.resolved;
      }

      const threads = await container.prisma.commentThread.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          boardId: true,
          nodeId: true,
          anchorX: true,
          anchorY: true,
          resolved: true,
          resolvedAt: true,
          createdById: true,
          createdAt: true,
          updatedAt: true,
          createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
          resolvedBy: { select: { id: true, name: true } },
          _count: { select: { messages: true } },
          messages: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' },
            take: 1,
            select: {
              id: true,
              body: true,
              authorId: true,
              createdAt: true,
              author: { select: { id: true, name: true, email: true, avatarUrl: true } },
            },
          },
          subscriptions: {
            where: { userId },
            select: { userId: true },
          },
        },
      });

      return reply.send({
        threads: threads.map((t) => ({
          id: t.id,
          boardId: t.boardId,
          nodeId: t.nodeId,
          anchorX: t.anchorX,
          anchorY: t.anchorY,
          resolved: t.resolved,
          resolvedAt: t.resolvedAt,
          createdById: t.createdById,
          createdBy: t.createdBy,
          resolvedBy: t.resolvedBy,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          messageCount: t._count.messages,
          firstMessage: t.messages[0] ?? null,
          subscribed: t.subscriptions.length > 0,
        })),
      });
    },
  );

  // ─── Get single thread with all messages ────────────────────────────
  app.get(
    '/boards/:boardId/threads/:threadId',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const params = threadParamsSchema.safeParse(request.params);
      if (!params.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: params.error.message,
        });
      }

      const access = await ensureBoardAccess({ userId, boardId: params.data.boardId });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Board not found' : 'Forbidden',
          status: access.status,
          detail: access.reason,
        });
      }

      const thread = await container.prisma.commentThread.findUnique({
        where: { id: params.data.threadId },
        select: {
          id: true,
          boardId: true,
          nodeId: true,
          anchorX: true,
          anchorY: true,
          resolved: true,
          resolvedAt: true,
          createdById: true,
          createdAt: true,
          updatedAt: true,
          createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
          resolvedBy: { select: { id: true, name: true } },
          subscriptions: {
            where: { userId },
            select: { userId: true },
          },
          messages: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              threadId: true,
              authorId: true,
              body: true,
              createdAt: true,
              updatedAt: true,
              deletedAt: true,
              author: { select: { id: true, name: true, email: true, avatarUrl: true } },
              reactions: {
                select: { messageId: true, emoji: true, userId: true },
              },
            },
          },
        },
      });

      if (!thread || thread.boardId !== params.data.boardId) {
        return sendProblem(reply, {
          title: 'Thread not found',
          status: 404,
          detail: 'Thread does not exist',
        });
      }

      return reply.send({
        ...thread,
        subscribed: thread.subscriptions.length > 0,
        subscriptions: undefined,
        messages: thread.messages.map((m) => ({
          ...m,
          body: m.deletedAt ? '' : m.body,
          deleted: !!m.deletedAt,
        })),
      });
    },
  );

  // ─── Create thread + first message ──────────────────────────────────
  app.post(
    '/boards/:boardId/threads',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const params = boardThreadParamsSchema.safeParse(request.params);
      if (!params.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: params.error.message,
        });
      }
      const body = createThreadBodySchema.safeParse(request.body);
      if (!body.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: body.error.message,
        });
      }

      const access = await ensureBoardAccess({ userId, boardId: params.data.boardId });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Board not found' : 'Forbidden',
          status: access.status,
          detail: access.reason,
        });
      }

      // Transactional: create thread + first message + auto-subscribe creator
      const thread = await container.prisma.$transaction(async (tx) => {
        const t = await tx.commentThread.create({
          data: {
            boardId: params.data.boardId,
            nodeId: body.data.nodeId ?? null,
            anchorX: body.data.anchorX,
            anchorY: body.data.anchorY,
            createdById: userId,
          },
        });

        await tx.commentMessage.create({
          data: {
            threadId: t.id,
            authorId: userId,
            body: body.data.body,
          },
        });

        await tx.threadSubscription.create({
          data: { threadId: t.id, userId },
        });

        return tx.commentThread.findUnique({
          where: { id: t.id },
          select: {
            id: true,
            boardId: true,
            nodeId: true,
            anchorX: true,
            anchorY: true,
            resolved: true,
            createdById: true,
            createdAt: true,
            updatedAt: true,
            createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
            messages: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                threadId: true,
                authorId: true,
                body: true,
                createdAt: true,
                updatedAt: true,
                deletedAt: true,
                author: { select: { id: true, name: true, email: true, avatarUrl: true } },
                reactions: true,
              },
            },
          },
        });
      });

      return reply.code(201).send({ ...thread, subscribed: true });
    },
  );

  // ─── Resolve / unresolve thread ─────────────────────────────────────
  app.patch(
    '/boards/:boardId/threads/:threadId',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const params = threadParamsSchema.safeParse(request.params);
      if (!params.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: params.error.message,
        });
      }
      const body = resolveThreadBodySchema.safeParse(request.body);
      if (!body.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: body.error.message,
        });
      }

      const access = await ensureBoardAccess({
        userId,
        boardId: params.data.boardId,
        requiredRoles: ['owner', 'editor'],
      });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Board not found' : 'Forbidden',
          status: access.status,
          detail: access.reason,
        });
      }

      const existing = await container.prisma.commentThread.findUnique({
        where: { id: params.data.threadId },
        select: { id: true, boardId: true },
      });
      if (!existing || existing.boardId !== params.data.boardId) {
        return sendProblem(reply, {
          title: 'Thread not found',
          status: 404,
          detail: 'Thread does not exist',
        });
      }

      const updated = await container.prisma.commentThread.update({
        where: { id: params.data.threadId },
        data: {
          resolved: body.data.resolved,
          resolvedAt: body.data.resolved ? new Date() : null,
          resolvedById: body.data.resolved ? userId : null,
        },
        select: {
          id: true,
          resolved: true,
          resolvedAt: true,
          resolvedBy: { select: { id: true, name: true } },
        },
      });

      return reply.send(updated);
    },
  );

  // ─── Move thread anchor (update anchorX/Y) ─────────────────────────
  app.patch(
    '/boards/:boardId/threads/:threadId/move',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const params = threadParamsSchema.safeParse(request.params);
      if (!params.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: params.error.message,
        });
      }
      const body = moveThreadBodySchema.safeParse(request.body);
      if (!body.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: body.error.message,
        });
      }

      const access = await ensureBoardAccess({
        userId,
        boardId: params.data.boardId,
        requiredRoles: ['owner', 'editor'],
      });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Board not found' : 'Forbidden',
          status: access.status,
          detail: access.reason,
        });
      }

      const existing = await container.prisma.commentThread.findUnique({
        where: { id: params.data.threadId },
        select: { id: true, boardId: true },
      });
      if (!existing || existing.boardId !== params.data.boardId) {
        return sendProblem(reply, {
          title: 'Thread not found',
          status: 404,
          detail: 'Thread does not exist',
        });
      }

      const updated = await container.prisma.commentThread.update({
        where: { id: params.data.threadId },
        data: {
          anchorX: body.data.anchorX,
          anchorY: body.data.anchorY,
        },
        select: { id: true, anchorX: true, anchorY: true },
      });

      return reply.send(updated);
    },
  );

  // ─── Delete thread ──────────────────────────────────────────────────
  app.delete(
    '/boards/:boardId/threads/:threadId',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const params = threadParamsSchema.safeParse(request.params);
      if (!params.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: params.error.message,
        });
      }

      const access = await ensureBoardAccess({ userId, boardId: params.data.boardId });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Board not found' : 'Forbidden',
          status: access.status,
          detail: access.reason,
        });
      }

      const thread = await container.prisma.commentThread.findUnique({
        where: { id: params.data.threadId },
        select: { id: true, boardId: true, createdById: true },
      });
      if (!thread || thread.boardId !== params.data.boardId) {
        return sendProblem(reply, {
          title: 'Thread not found',
          status: 404,
          detail: 'Thread does not exist',
        });
      }

      // Only thread creator or board owner can delete
      const isOwnerOrEditor = access.membership?.role === 'owner';
      if (thread.createdById !== userId && !isOwnerOrEditor) {
        return sendProblem(reply, {
          title: 'Forbidden',
          status: 403,
          detail: 'Only thread creator or board owner can delete',
        });
      }

      await container.prisma.commentThread.delete({ where: { id: params.data.threadId } });
      return reply.code(204).send();
    },
  );

  // ─── Add reply message to thread ────────────────────────────────────
  app.post(
    '/boards/:boardId/threads/:threadId/messages',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const params = threadParamsSchema.safeParse(request.params);
      if (!params.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: params.error.message,
        });
      }
      const body = addReplyBodySchema.safeParse(request.body);
      if (!body.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: body.error.message,
        });
      }

      const access = await ensureBoardAccess({ userId, boardId: params.data.boardId });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Board not found' : 'Forbidden',
          status: access.status,
          detail: access.reason,
        });
      }

      const thread = await container.prisma.commentThread.findUnique({
        where: { id: params.data.threadId },
        select: { id: true, boardId: true },
      });
      if (!thread || thread.boardId !== params.data.boardId) {
        return sendProblem(reply, {
          title: 'Thread not found',
          status: 404,
          detail: 'Thread does not exist',
        });
      }

      const message = await container.prisma.$transaction(async (tx) => {
        const msg = await tx.commentMessage.create({
          data: {
            threadId: params.data.threadId,
            authorId: userId,
            body: body.data.body,
          },
          select: {
            id: true,
            threadId: true,
            authorId: true,
            body: true,
            createdAt: true,
            updatedAt: true,
            author: { select: { id: true, name: true, email: true, avatarUrl: true } },
            reactions: true,
          },
        });

        // Auto-subscribe replier (upsert to avoid duplicates)
        await tx.threadSubscription.upsert({
          where: { threadId_userId: { threadId: params.data.threadId, userId } },
          create: { threadId: params.data.threadId, userId },
          update: {},
        });

        return msg;
      });

      return reply.code(201).send(message);
    },
  );

  // ─── Edit message ───────────────────────────────────────────────────
  app.patch(
    '/boards/:boardId/threads/:threadId/messages/:messageId',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const params = messageParamsSchema.safeParse(request.params);
      if (!params.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: params.error.message,
        });
      }
      const body = editMessageBodySchema.safeParse(request.body);
      if (!body.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: body.error.message,
        });
      }

      const access = await ensureBoardAccess({ userId, boardId: params.data.boardId });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Board not found' : 'Forbidden',
          status: access.status,
          detail: access.reason,
        });
      }

      const message = await container.prisma.commentMessage.findUnique({
        where: { id: params.data.messageId },
        select: {
          id: true,
          threadId: true,
          authorId: true,
          deletedAt: true,
          thread: { select: { boardId: true } },
        },
      });
      if (
        !message ||
        message.threadId !== params.data.threadId ||
        message.thread.boardId !== params.data.boardId
      ) {
        return sendProblem(reply, {
          title: 'Message not found',
          status: 404,
          detail: 'Message does not exist',
        });
      }
      if (message.deletedAt) {
        return sendProblem(reply, {
          title: 'Message deleted',
          status: 410,
          detail: 'Cannot edit a deleted message',
        });
      }
      if (message.authorId !== userId) {
        return sendProblem(reply, {
          title: 'Forbidden',
          status: 403,
          detail: 'Only the author can edit this message',
        });
      }

      const updated = await container.prisma.commentMessage.update({
        where: { id: params.data.messageId },
        data: { body: body.data.body },
        select: {
          id: true,
          threadId: true,
          authorId: true,
          body: true,
          createdAt: true,
          updatedAt: true,
          author: { select: { id: true, name: true, email: true, avatarUrl: true } },
          reactions: true,
        },
      });

      return reply.send(updated);
    },
  );

  // ─── Soft-delete message ────────────────────────────────────────────
  app.delete(
    '/boards/:boardId/threads/:threadId/messages/:messageId',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const params = messageParamsSchema.safeParse(request.params);
      if (!params.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: params.error.message,
        });
      }

      const access = await ensureBoardAccess({ userId, boardId: params.data.boardId });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Board not found' : 'Forbidden',
          status: access.status,
          detail: access.reason,
        });
      }

      const message = await container.prisma.commentMessage.findUnique({
        where: { id: params.data.messageId },
        select: { id: true, threadId: true, authorId: true, thread: { select: { boardId: true } } },
      });
      if (
        !message ||
        message.threadId !== params.data.threadId ||
        message.thread.boardId !== params.data.boardId
      ) {
        return sendProblem(reply, {
          title: 'Message not found',
          status: 404,
          detail: 'Message does not exist',
        });
      }

      const isOwner = access.membership?.role === 'owner';
      if (message.authorId !== userId && !isOwner) {
        return sendProblem(reply, {
          title: 'Forbidden',
          status: 403,
          detail: 'Only author or board owner can delete',
        });
      }

      await container.prisma.commentMessage.update({
        where: { id: params.data.messageId },
        data: { deletedAt: new Date() },
      });

      return reply.code(204).send();
    },
  );

  // ─── Toggle reaction (idempotent PUT) ───────────────────────────────
  app.put(
    '/boards/:boardId/threads/:threadId/messages/:messageId/reactions',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const params = messageParamsSchema.safeParse(request.params);
      if (!params.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: params.error.message,
        });
      }
      const body = toggleReactionBodySchema.safeParse(request.body);
      if (!body.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: body.error.message,
        });
      }

      const access = await ensureBoardAccess({ userId, boardId: params.data.boardId });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Board not found' : 'Forbidden',
          status: access.status,
          detail: access.reason,
        });
      }

      const message = await container.prisma.commentMessage.findUnique({
        where: { id: params.data.messageId },
        select: { id: true, threadId: true, thread: { select: { boardId: true } } },
      });
      if (
        !message ||
        message.threadId !== params.data.threadId ||
        message.thread.boardId !== params.data.boardId
      ) {
        return sendProblem(reply, {
          title: 'Message not found',
          status: 404,
          detail: 'Message does not exist',
        });
      }

      // Toggle: if exists, remove; if not, add
      const existing = await container.prisma.messageReaction.findUnique({
        where: {
          messageId_emoji_userId: {
            messageId: params.data.messageId,
            emoji: body.data.emoji,
            userId,
          },
        },
      });

      if (existing) {
        await container.prisma.messageReaction.delete({
          where: {
            messageId_emoji_userId: {
              messageId: params.data.messageId,
              emoji: body.data.emoji,
              userId,
            },
          },
        });
      } else {
        await container.prisma.messageReaction.create({
          data: {
            messageId: params.data.messageId,
            emoji: body.data.emoji,
            userId,
          },
        });
      }

      // Return updated reactions for this message
      const reactions = await container.prisma.messageReaction.findMany({
        where: { messageId: params.data.messageId },
        select: { emoji: true, userId: true },
      });

      return reply.send({ toggled: !existing, reactions });
    },
  );

  // ─── Toggle subscription ────────────────────────────────────────────
  app.put(
    '/boards/:boardId/threads/:threadId/subscription',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const params = threadParamsSchema.safeParse(request.params);
      if (!params.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: params.error.message,
        });
      }
      const body = toggleSubscriptionBodySchema.safeParse(request.body);
      if (!body.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: body.error.message,
        });
      }

      const access = await ensureBoardAccess({ userId, boardId: params.data.boardId });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Board not found' : 'Forbidden',
          status: access.status,
          detail: access.reason,
        });
      }

      const thread = await container.prisma.commentThread.findUnique({
        where: { id: params.data.threadId },
        select: { id: true, boardId: true },
      });
      if (!thread || thread.boardId !== params.data.boardId) {
        return sendProblem(reply, {
          title: 'Thread not found',
          status: 404,
          detail: 'Thread does not exist',
        });
      }

      if (body.data.subscribed) {
        await container.prisma.threadSubscription.upsert({
          where: { threadId_userId: { threadId: params.data.threadId, userId } },
          create: { threadId: params.data.threadId, userId },
          update: {},
        });
      } else {
        await container.prisma.threadSubscription.deleteMany({
          where: { threadId: params.data.threadId, userId },
        });
      }

      return reply.send({ subscribed: body.data.subscribed });
    },
  );
}
