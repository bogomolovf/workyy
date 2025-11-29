import { prisma } from '../lib/prisma';

export async function ensureBoardAccess(params: {
  userId: string;
  boardId: string;
  requiredRoles?: ('owner' | 'editor' | 'viewer')[];
}) {
  const { userId, boardId, requiredRoles = ['owner', 'editor', 'viewer'] } = params;

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: {
      id: true,
      workspaceId: true,
    },
  });

  if (!board) {
    return { ok: false, status: 404 as const, reason: 'Board not found' };
  }

  const membership = await prisma.userWorkspaceRole.findUnique({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId: board.workspaceId,
      },
    },
  });

  if (!membership || !requiredRoles.includes(membership.role)) {
    return { ok: false, status: 403 as const, reason: 'Forbidden' };
  }

  return { ok: true, board, membership };
}

export async function ensureWorkspaceAccess(params: {
  userId: string;
  workspaceId: string;
  requiredRoles?: ('owner' | 'editor' | 'viewer')[];
}) {
  const { userId, workspaceId, requiredRoles = ['owner', 'editor', 'viewer'] } = params;

  const membership = await prisma.userWorkspaceRole.findUnique({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId,
      },
    },
  });

  if (!membership || !requiredRoles.includes(membership.role)) {
    return { ok: false, status: 403 as const, reason: 'Forbidden' };
  }

  return { ok: true, membership };
}

