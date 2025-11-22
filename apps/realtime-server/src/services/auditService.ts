import { Prisma, PrismaClient } from '@prisma/client';

export type AuditEventInput = {
  type: string;
  boardId?: string | null;
  workspaceId?: string | null;
  runId?: string | null;
  payload?: Record<string, unknown>;
};

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient;

export class AuditService {
  constructor(private readonly prisma: PrismaClient) {}

  private client(client?: PrismaClientOrTx): PrismaClientOrTx {
    return client ?? this.prisma;
  }

  async record(event: AuditEventInput, client?: PrismaClientOrTx) {
    return this.client(client).auditEvent.create({
      data: {
        type: event.type,
        boardId: event.boardId ?? null,
        workspaceId: event.workspaceId ?? null,
        runId: event.runId ?? null,
        payload: event.payload ?? {},
      },
    });
  }
}

