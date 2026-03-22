import { FastifyInstance } from 'fastify';
import { container } from '../container';
import { sendProblem } from '../lib/problem';
import { ensureWorkspaceAccess } from '../services/authorizationService';
import {
  getWorkspaceParamsSchema,
  addWorkspaceMemberBodySchema,
  removeWorkspaceMemberParamsSchema,
  updateWorkspaceMemberRoleBodySchema,
} from '../validators/workspaces';

export async function workspacesRoutes(app: FastifyInstance) {
  // Get workspace members
  app.get(
    '/workspaces/:workspaceId/members',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const parseParams = getWorkspaceParamsSchema.safeParse(request.params);
      if (!parseParams.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parseParams.error.message,
          errors: parseParams.error.flatten(),
        });
      }

      const { workspaceId } = parseParams.data;

      // Check workspace access
      const access = await ensureWorkspaceAccess({ userId, workspaceId });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Workspace not found' : 'Forbidden',
          status: access.status,
          detail: access.reason,
        });
      }

      // Get all members of the workspace
      const members = await container.prisma.userWorkspaceRole.findMany({
        where: { workspaceId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: [
          { role: 'asc' }, // owners first
          { addedAt: 'asc' },
        ],
      });

      return reply.send({
        members: members.map((member) => ({
          userId: member.userId,
          email: member.user.email,
          name: member.user.name,
          avatarUrl: member.user.avatarUrl,
          role: member.role,
          addedAt: member.addedAt.toISOString(),
        })),
      });
    },
  );

  // Add member to workspace by email
  app.post(
    '/workspaces/:workspaceId/members',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const parseParams = getWorkspaceParamsSchema.safeParse(request.params);
      if (!parseParams.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parseParams.error.message,
          errors: parseParams.error.flatten(),
        });
      }

      const parseBody = addWorkspaceMemberBodySchema.safeParse(request.body);
      if (!parseBody.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parseBody.error.message,
          errors: parseBody.error.flatten(),
        });
      }

      const { workspaceId } = parseParams.data;
      const { email, role } = parseBody.data;

      // Check workspace access (only owner/editor can add members)
      const access = await ensureWorkspaceAccess({
        userId,
        workspaceId,
        requiredRoles: ['owner', 'editor'],
      });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Workspace not found' : 'Forbidden',
          status: access.status,
          detail: access.reason,
        });
      }

      // Find user by email
      const userToAdd = await container.prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, name: true },
      });

      if (!userToAdd) {
        return sendProblem(reply, {
          title: 'User not found',
          status: 404,
          detail: `User with email ${email} does not exist`,
        });
      }

      // Check if user is already a member
      const existingMember = await container.prisma.userWorkspaceRole.findUnique({
        where: {
          userId_workspaceId: {
            userId: userToAdd.id,
            workspaceId,
          },
        },
      });

      if (existingMember) {
        return sendProblem(reply, {
          title: 'User already a member',
          status: 409,
          detail: `User ${email} is already a member of this workspace`,
        });
      }

      // Add user to workspace
      await container.prisma.userWorkspaceRole.create({
        data: {
          userId: userToAdd.id,
          workspaceId,
          role,
        },
      });

      // Record audit event
      await container.auditService.record(
        {
          type: 'workspace.member.added',
          workspaceId,
          payload: {
            addedUserId: userToAdd.id,
            addedUserEmail: email,
            role,
            addedBy: userId,
          },
        },
        container.prisma,
      );

      return reply.code(201).send({
        userId: userToAdd.id,
        email: userToAdd.email,
        name: userToAdd.name,
        role,
      });
    },
  );

  // Remove member from workspace
  app.delete(
    '/workspaces/:workspaceId/members/:userId',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const parseParams = removeWorkspaceMemberParamsSchema.safeParse(request.params);
      if (!parseParams.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parseParams.error.message,
          errors: parseParams.error.flatten(),
        });
      }

      const { workspaceId, userId: memberUserId } = parseParams.data;

      // Check workspace access (only owner/editor can remove members)
      const access = await ensureWorkspaceAccess({
        userId,
        workspaceId,
        requiredRoles: ['owner', 'editor'],
      });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Workspace not found' : 'Forbidden',
          status: access.status,
          detail: access.reason,
        });
      }

      // Prevent removing yourself (optional business rule)
      if (memberUserId === userId) {
        return sendProblem(reply, {
          title: 'Cannot remove yourself',
          status: 400,
          detail: 'You cannot remove yourself from the workspace',
        });
      }

      // Check if member exists
      const member = await container.prisma.userWorkspaceRole.findUnique({
        where: {
          userId_workspaceId: {
            userId: memberUserId,
            workspaceId,
          },
        },
        include: {
          user: {
            select: { email: true },
          },
        },
      });

      if (!member) {
        return sendProblem(reply, {
          title: 'Member not found',
          status: 404,
          detail: 'User is not a member of this workspace',
        });
      }

      // Remove member
      await container.prisma.userWorkspaceRole.delete({
        where: {
          userId_workspaceId: {
            userId: memberUserId,
            workspaceId,
          },
        },
      });

      // Record audit event
      await container.auditService.record(
        {
          type: 'workspace.member.removed',
          workspaceId,
          payload: {
            removedUserId: memberUserId,
            removedUserEmail: member.user.email,
            removedBy: userId,
          },
        },
        container.prisma,
      );

      return reply.code(204).send();
    },
  );

  // Update member role
  app.patch(
    '/workspaces/:workspaceId/members/:userId',
    { preValidation: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const parseParams = removeWorkspaceMemberParamsSchema.safeParse(request.params);
      if (!parseParams.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parseParams.error.message,
          errors: parseParams.error.flatten(),
        });
      }

      const parseBody = updateWorkspaceMemberRoleBodySchema.safeParse(request.body);
      if (!parseBody.success) {
        return sendProblem(reply, {
          title: 'Validation error',
          status: 422,
          detail: parseBody.error.message,
          errors: parseBody.error.flatten(),
        });
      }

      const { workspaceId, userId: memberUserId } = parseParams.data;
      const { role } = parseBody.data;

      // Check workspace access (only owner can change roles)
      const access = await ensureWorkspaceAccess({
        userId,
        workspaceId,
        requiredRoles: ['owner'],
      });
      if (!access.ok) {
        return sendProblem(reply, {
          title: access.status === 404 ? 'Workspace not found' : 'Forbidden',
          status: access.status,
          detail: access.reason,
        });
      }

      // Check if member exists
      const member = await container.prisma.userWorkspaceRole.findUnique({
        where: {
          userId_workspaceId: {
            userId: memberUserId,
            workspaceId,
          },
        },
        include: {
          user: {
            select: { email: true },
          },
        },
      });

      if (!member) {
        return sendProblem(reply, {
          title: 'Member not found',
          status: 404,
          detail: 'User is not a member of this workspace',
        });
      }

      // Update role
      await container.prisma.userWorkspaceRole.update({
        where: {
          userId_workspaceId: {
            userId: memberUserId,
            workspaceId,
          },
        },
        data: { role },
      });

      // Record audit event
      await container.auditService.record(
        {
          type: 'workspace.member.role.updated',
          workspaceId,
          payload: {
            userId: memberUserId,
            userEmail: member.user.email,
            oldRole: member.role,
            newRole: role,
            updatedBy: userId,
          },
        },
        container.prisma,
      );

      return reply.send({
        userId: memberUserId,
        role,
      });
    },
  );
}
