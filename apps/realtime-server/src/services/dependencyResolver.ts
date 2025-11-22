import { Prisma, PrismaClient } from '@prisma/client';
import { DagEdge, getDownstreamNodeIds } from '@workyy/dag-executor';

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient;

export class DependencyResolver {
  constructor(private readonly prisma: PrismaClient) {}

  private client(client?: PrismaClientOrTx): PrismaClientOrTx {
    return client ?? this.prisma;
  }

  async getDownstreamNodeIds(
    boardId: string,
    nodeId: string,
    client?: PrismaClientOrTx,
  ): Promise<string[]> {
    const edges = await this.client(client).edge.findMany({
      where: { boardId },
      select: { id: true, sourceId: true, targetId: true },
    });

    const dagEdges: DagEdge[] = edges.map((edge) => ({
      id: edge.id,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
    }));

    return getDownstreamNodeIds(nodeId, dagEdges);
  }
}

