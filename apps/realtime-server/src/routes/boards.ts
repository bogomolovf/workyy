import { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { container } from '../container';
import { sendProblem } from '../lib/problem';
import { ensureBoardAccess, ensureWorkspaceAccess } from '../services/authorizationService';
import {
  createBoardBodySchema,
  getBoardParamsSchema,
  listBoardsQuerySchema,
  updateBoardContentSchema,
  updateBoardMetadataSchema,
} from '../validators/boards';

export async function boardsRoutes(app: FastifyInstance) {
  app.get('/boards', { preValidation: [app.authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    const parsedQuery = listBoardsQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      return sendProblem(reply, {
        title: 'Validation error',
        status: 422,
        detail: parsedQuery.error.message,
        errors: parsedQuery.error.flatten(),
      });
    }

    const { workspaceId } = parsedQuery.data;

    // Get user's workspace IDs
    const userWorkspaces = await container.prisma.userWorkspaceRole.findMany({
      where: { userId },
      select: { workspaceId: true },
    });
    const userWorkspaceIds = userWorkspaces.map((uw) => uw.workspaceId);

    // Filter boards by user's workspaces
    const whereClause: Prisma.BoardWhereInput = {
      workspaceId: { in: userWorkspaceIds },
      ...(workspaceId ? { workspaceId } : {}),
    };

    // If specific workspaceId is provided, check access
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

    const boards = await container.prisma.board.findMany({
      where: whereClause,
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: {
            nodes: true,
            edges: true,
          },
        },
      },
    });

    return reply.send({
      boards: boards.map((board) => ({
        id: board.id,
        workspaceId: board.workspaceId,
        title: board.title,
        description: board.description,
        createdAt: board.createdAt,
        updatedAt: board.updatedAt,
        stats: {
          nodes: board._count.nodes,
          edges: board._count.edges,
        },
      })),
    });
  });

  app.post('/boards', { preValidation: [app.authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    const parseResult = createBoardBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return sendProblem(reply, {
        title: 'Validation error',
        status: 422,
        detail: parseResult.error.message,
        errors: parseResult.error.flatten(),
      });
    }
    const body = parseResult.data;

    // Check workspace access
    const access = await ensureWorkspaceAccess({
      userId,
      workspaceId: body.workspaceId,
      requiredRoles: ['owner', 'editor'],
    });
    if (!access.ok) {
      return sendProblem(reply, {
        title: access.status === 404 ? 'Workspace not found' : 'Forbidden',
        status: access.status,
        detail: access.reason,
      });
    }

    try {
      const board = await container.prisma.board.create({
        data: {
          workspaceId: body.workspaceId,
          ownerId: userId,
          title: body.title,
          description: body.description ?? undefined,
        },
      });

      await container.auditService.record({
        type: 'board.created',
        boardId: board.id,
        workspaceId: board.workspaceId,
        payload: { title: board.title },
      });

      return reply.code(201).send(board);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return sendProblem(reply, {
          title: 'Board title already exists',
          status: 409,
          detail: 'Board title must be unique within a workspace',
        });
      }
      request.log.error({ err: error }, 'Failed to create board');
      return sendProblem(reply, {
        title: 'Internal server error',
        status: 500,
        detail: 'Unable to create board',
      });
    }
  });

  app.get('/boards/:boardId', { 
    preValidation: [app.authenticate],
    logLevel: 'silent', // Disable logging to avoid CSV data in response logs
  }, async (request, reply) => {
    const userId = request.user!.userId;
    const parseParams = getBoardParamsSchema.safeParse(request.params);
    if (!parseParams.success) {
      return sendProblem(reply, {
        title: 'Validation error',
        status: 422,
        detail: parseParams.error.message,
        errors: parseParams.error.flatten(),
      });
    }

    const boardId = parseParams.data.boardId;

    // Check board access
    const access = await ensureBoardAccess({ userId, boardId });
    if (!access.ok) {
      return sendProblem(reply, {
        title: access.status === 404 ? 'Board not found' : 'Forbidden',
        status: access.status,
        detail: access.reason,
      });
    }

    const board = await container.prisma.board.findUnique({
      where: { id: boardId },
      include: {
        nodes: true,
        edges: true,
      },
    });

    if (!board) {
      return sendProblem(reply, {
        title: 'Board not found',
        status: 404,
        detail: `Board ${boardId} does not exist`,
      });
    }

    return reply.send({
      board: {
        id: board.id,
        workspaceId: board.workspaceId,
        title: board.title,
        description: board.description,
        createdAt: board.createdAt,
        updatedAt: board.updatedAt,
      },
      nodes: board.nodes.map((node) => ({
        id: node.id,
        boardId: node.boardId,
        type: node.type,
        position: { x: node.positionX, y: node.positionY },
        payload: node.payload,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
      })),
      edges: board.edges.map((edge) => ({
        id: edge.id,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        metadata: edge.metadata,
      })),
    });
  });

  app.patch('/boards/:boardId', { preValidation: [app.authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    const parseParams = getBoardParamsSchema.safeParse(request.params);
    if (!parseParams.success) {
      return sendProblem(reply, {
        title: 'Validation error',
        status: 422,
        detail: parseParams.error.message,
        errors: parseParams.error.flatten(),
      });
    }

    const parseBody = updateBoardMetadataSchema.safeParse(request.body);
    if (!parseBody.success) {
      return sendProblem(reply, {
        title: 'Validation error',
        status: 422,
        detail: parseBody.error.message,
        errors: parseBody.error.flatten(),
      });
    }

    const boardId = parseParams.data.boardId;

    // Check board access (owner or editor can update)
    const access = await ensureBoardAccess({
      userId,
      boardId,
      requiredRoles: ['owner', 'editor'],
    });
    if (!access.ok) {
      return sendProblem(reply, {
        title: access.status === 404 ? 'Board not found' : 'Forbidden',
        status: access.status,
        detail: access.reason,
      });
    }

    const exists = await container.prisma.board.findUnique({
      where: { id: boardId },
      select: { id: true, workspaceId: true, title: true },
    });

    if (!exists) {
      return sendProblem(reply, {
        title: 'Board not found',
        status: 404,
        detail: `Board ${boardId} does not exist`,
      });
    }

    const updated = await container.prisma.board.update({
      where: { id: boardId },
      data: {
        ...(parseBody.data.title !== undefined ? { title: parseBody.data.title } : {}),
        ...(parseBody.data.description !== undefined
          ? { description: parseBody.data.description }
          : {}),
      },
    });

    await container.auditService.record({
      type: 'board.updated',
      boardId: updated.id,
      workspaceId: updated.workspaceId,
      payload: {
        title: updated.title,
      },
    });

    return reply.send({
      board: {
        id: updated.id,
        workspaceId: updated.workspaceId,
        title: updated.title,
        description: updated.description,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  });

  app.put(
    '/boards/:boardId/nodes',
    { 
      preValidation: [app.authenticate],
      logLevel: 'silent', // Disable logging for this route to avoid CSV data in logs
    },
    async (request, reply) => {
      const userId = request.user!.userId;
      const parseParams = getBoardParamsSchema.safeParse(request.params);
      if (!parseParams.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parseParams.error.message,
          errors: parseParams.error.flatten(),
        });
      }

      const parsedBody = updateBoardContentSchema.safeParse(request.body);
      if (!parsedBody.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parsedBody.error.message,
          errors: parsedBody.error.flatten(),
        });
      }

      const boardId = parseParams.data.boardId;
      const { nodes, edges } = parsedBody.data;

      // Check board access (owner or editor can update)
      const access = await ensureBoardAccess({
        userId,
        boardId,
        requiredRoles: ['owner', 'editor'],
      });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Board not found' : 'Forbidden',
          status: access.status,
          detail: access.reason,
        });
      }

      const existingNodes = await container.prisma.node.findMany({
        where: { boardId },
        select: { id: true },
      });
      const incomingNodeIds = new Set(nodes.map((node) => node.id));
      const nodesToDelete = existingNodes.filter((node) => !incomingNodeIds.has(node.id));
      if (nodesToDelete.length > 0) {
        await container.prisma.node.deleteMany({
          where: {
            boardId,
            id: { in: nodesToDelete.map((node) => node.id) },
          },
        });
      }

      for (const node of nodes) {
        try {
          await container.prisma.node.upsert({
            where: { id: node.id },
            create: {
              id: node.id,
              boardId,
              type: node.type,
              positionX: node.position.x,
              positionY: node.position.y,
              payload: node.payload ?? Prisma.JsonNull,
            },
            update: {
              positionX: node.position.x,
              positionY: node.position.y,
              type: node.type,
              ...(node.payload !== undefined ? { payload: node.payload } : {}),
            },
          });
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          throw new Error(`Failed to upsert node ${node.id} (type: ${node.type}): ${errMsg}`);
        }
      }

      const existingEdges = await container.prisma.edge.findMany({
        where: { boardId },
        select: { id: true },
      });
      const incomingEdgeIds = new Set(edges.map((edge) => edge.id));
      const edgesToDelete = existingEdges.filter((edge) => !incomingEdgeIds.has(edge.id));
      if (edgesToDelete.length > 0) {
        await container.prisma.edge.deleteMany({
          where: {
            boardId,
            id: { in: edgesToDelete.map((edge) => edge.id) },
          },
        });
      }

      for (const edge of edges) {
        await container.prisma.edge.upsert({
          where: { id: edge.id },
          create: {
            id: edge.id,
            boardId,
            sourceId: edge.sourceId,
            targetId: edge.targetId,
            metadata: edge.metadata ?? Prisma.JsonNull,
          },
          update: {
            sourceId: edge.sourceId,
            targetId: edge.targetId,
            ...(edge.metadata !== undefined ? { metadata: edge.metadata } : {}),
          },
        });
      }

      await container.prisma.board.update({
        where: { id: boardId },
        data: { updatedAt: new Date() },
      });

      return reply.send({ nodes: nodes.length, edges: edges.length });
    },
  );

  app.delete('/boards/:boardId', { preValidation: [app.authenticate] }, async (request, reply) => {
    const userId = request.user!.userId;
    const parseParams = getBoardParamsSchema.safeParse(request.params);
    if (!parseParams.success) {
      return sendProblem(reply, {
        title: 'Validation error',
        status: 422,
        detail: parseParams.error.message,
        errors: parseParams.error.flatten(),
      });
    }

    const boardId = parseParams.data.boardId;

    // Check board access (only owner can delete)
    const access = await ensureBoardAccess({
      userId,
      boardId,
      requiredRoles: ['owner'],
    });
    if (!access.ok) {
      return sendProblem(reply, {
        title: access.status === 404 ? 'Board not found' : 'Forbidden',
        status: access.status,
        detail: access.reason,
      });
    }

    const board = await container.prisma.board.findUnique({
      where: { id: boardId },
      select: { id: true, workspaceId: true, title: true },
    });

    if (!board) {
      return sendProblem(reply, {
        title: 'Board not found',
        status: 404,
        detail: `Board ${boardId} does not exist`,
      });
    }

    await container.prisma.board.delete({
      where: { id: boardId },
    });

    await container.auditService.record({
      type: 'board.deleted',
      boardId: board.id,
      workspaceId: board.workspaceId,
      payload: { title: board.title },
    });

    return reply.code(204).send();
  });
}
