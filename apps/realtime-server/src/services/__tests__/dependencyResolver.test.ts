import { describe, expect, it, vi } from 'vitest';
import { DependencyResolver } from '../dependencyResolver';

describe('DependencyResolver', () => {
  it('returns downstream node ids', async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: 'edge-1', sourceId: 'node-1', targetId: 'node-2' },
      { id: 'edge-2', sourceId: 'node-2', targetId: 'node-3' },
      { id: 'edge-3', sourceId: 'node-3', targetId: 'node-4' },
      { id: 'edge-4', sourceId: 'node-1', targetId: 'node-5' },
    ]);

    const prisma = { edge: { findMany } } as any;
    const resolver = new DependencyResolver(prisma);

    const downstream = await resolver.getDownstreamNodeIds('board-1', 'node-1');

    expect(findMany).toHaveBeenCalledWith({
      where: { boardId: 'board-1' },
      select: { id: true, sourceId: true, targetId: true },
    });
    expect(downstream).toEqual(['node-2', 'node-5', 'node-3', 'node-4']);
  });
});

