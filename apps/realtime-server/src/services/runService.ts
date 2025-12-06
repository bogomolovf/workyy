import { Prisma, PrismaClient, Run, RunRequestStatus, RunStatus, RunTrigger } from '@prisma/client';
import { DependencyResolver } from './dependencyResolver';
import { AuditService } from './auditService';

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient;

export class NodeNotFoundError extends Error {
  constructor(public readonly nodeId: string) {
    super(`Node ${nodeId} not found`);
  }
}

export interface QueueRunParams {
  nodeId: string;
  trigger: RunTrigger;
  idempotencyKey: string;
  inputs?: Record<string, unknown>;
}

export interface QueueRunResult {
  run: Run;
  duplicate: boolean;
  boardId: string;
  workspaceId: string;
}

export interface RunCompletionResult {
  run: Run;
  downstreamNodeIds: string[];
  boardId: string;
  workspaceId: string;
}

export class RunService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly dependencyResolver: DependencyResolver,
    private readonly auditService: AuditService,
  ) {}

  private client(client?: PrismaClientOrTx): PrismaClientOrTx {
    return client ?? this.prisma;
  }

  async queueRun(params: QueueRunParams): Promise<QueueRunResult> {
    return this.prisma.$transaction(async (tx) => {
      const existingRequest = await tx.runRequest.findUnique({
        where: { idempotencyKey: params.idempotencyKey },
        include: {
          run: true,
          node: {
            include: {
              board: {
                select: { workspaceId: true },
              },
            },
          },
        },
      });

      if (existingRequest?.run) {
        await tx.runRequest.update({
          where: { id: existingRequest.id },
          data: { status: RunRequestStatus.duplicate },
        });

        await this.auditService.record(
          {
            type: 'run.duplicate',
            runId: existingRequest.run.id,
            boardId: existingRequest.node.boardId,
            workspaceId: existingRequest.node.board.workspaceId,
            payload: { trigger: params.trigger },
          },
          tx,
        );

        return {
          run: existingRequest.run,
          duplicate: true,
          boardId: existingRequest.node.boardId,
          workspaceId: existingRequest.node.board.workspaceId,
        };
      }

      const node = existingRequest
        ? existingRequest.node
        : await tx.node.findUnique({
            where: { id: params.nodeId },
            include: {
              board: {
                select: { workspaceId: true },
              },
            },
          });

      if (!node) {
        throw new NodeNotFoundError(params.nodeId);
      }

      const runRequestRecord =
        existingRequest ??
        (await tx.runRequest.create({
          data: {
            boardId: node.boardId,
            nodeId: node.id,
            idempotencyKey: params.idempotencyKey,
            status: RunRequestStatus.pending,
            inputs: params.inputs ?? {},
          },
        }));

      const runRecord = await tx.run.create({
        data: {
          nodeId: node.id,
          boardId: node.boardId,
          status: RunStatus.queued,
          trigger: params.trigger,
        },
      });

      await tx.runRequest.update({
        where: { id: runRequestRecord.id },
        data: { runId: runRecord.id },
      });

      await this.auditService.record(
        {
          type: 'run.queued',
          boardId: node.boardId,
          workspaceId: node.board.workspaceId,
          runId: runRecord.id,
          payload: { trigger: params.trigger },
        },
        tx,
      );

      return {
        run: runRecord,
        duplicate: false,
        boardId: node.boardId,
        workspaceId: node.board.workspaceId,
      };
    });
  }

  async markRunSucceeded(
    runId: string,
    options?: { outputArrow?: Buffer | null },
  ): Promise<RunCompletionResult> {
    const result = await this.prisma.$transaction(async (tx) => {
      const updatedRun = await tx.run.update({
        where: { id: runId },
        data: {
          status: RunStatus.succeeded,
          finishedAt: new Date(),
          outputArrow: options?.outputArrow ?? null,
          error: null,
        },
        include: {
          board: {
            select: { id: true, workspaceId: true },
          },
        },
      });

      await tx.runRequest.updateMany({
        where: { runId },
        data: { status: RunRequestStatus.completed },
      });

      const downstreamNodeIds = await this.dependencyResolver.getDownstreamNodeIds(
        updatedRun.boardId,
        updatedRun.nodeId,
        tx,
      );

      await this.auditService.record(
        {
          type: 'run.succeeded',
          boardId: updatedRun.boardId,
          workspaceId: updatedRun.board.workspaceId,
          runId: updatedRun.id,
          payload: { downstream: downstreamNodeIds },
        },
        tx,
      );

      return {
        run: (({ board, ...rest }) => rest)(updatedRun),
        workspaceId: updatedRun.board.workspaceId,
        downstreamNodeIds,
        boardId: updatedRun.boardId,
      };
    });

    return {
      run: result.run as Run,
      downstreamNodeIds: result.downstreamNodeIds,
      boardId: result.boardId,
      workspaceId: result.workspaceId,
    };
  }

  async markRunFailed(runId: string, reason: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const updatedRun = await tx.run.update({
        where: { id: runId },
        data: {
          status: RunStatus.failed,
          finishedAt: new Date(),
          error: reason,
        },
        include: {
          board: {
            select: { workspaceId: true },
          },
        },
      });

      await tx.runRequest.updateMany({
        where: { runId },
        data: { status: RunRequestStatus.completed },
      });

      await this.auditService.record(
        {
          type: 'run.failed',
          boardId: updatedRun.boardId,
          workspaceId: updatedRun.board.workspaceId,
          runId: updatedRun.id,
          payload: { reason },
        },
        tx,
      );
    });
  }

  async getRunById(runId: string, client?: PrismaClientOrTx) {
    return this.client(client).run.findUnique({ where: { id: runId } });
  }
}
