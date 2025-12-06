import { describe, expect, it, vi } from 'vitest';
import { RunProcessor } from '../runProcessor';

vi.useFakeTimers();

describe('RunProcessor', () => {
  it('marks runs as succeeded and queues downstream nodes', async () => {
    const markRunSucceeded = vi
      .fn()
      .mockResolvedValueOnce({
        run: {
          id: 'run-1',
          nodeId: 'node-1',
          boardId: 'board-1',
          status: 'succeeded',
          trigger: 'manual',
          startedAt: new Date(),
          finishedAt: new Date(),
          outputArrow: null,
          error: null,
        },
        downstreamNodeIds: ['node-2'],
        boardId: 'board-1',
        workspaceId: 'workspace-1',
      })
      .mockResolvedValueOnce({
        run: {
          id: 'run-2',
          nodeId: 'node-2',
          boardId: 'board-1',
          status: 'succeeded',
          trigger: 'upstream',
          startedAt: new Date(),
          finishedAt: new Date(),
          outputArrow: null,
          error: null,
        },
        downstreamNodeIds: [],
        boardId: 'board-1',
        workspaceId: 'workspace-1',
      });

    const queueRun = vi
      .fn()
      .mockResolvedValueOnce({
        run: {
          id: 'run-2',
          nodeId: 'node-2',
          boardId: 'board-1',
          status: 'queued',
          trigger: 'upstream',
          startedAt: new Date(),
          finishedAt: null,
          outputArrow: null,
          error: null,
        },
        duplicate: false,
        boardId: 'board-1',
        workspaceId: 'workspace-1',
      })
      .mockResolvedValueOnce({
        run: {
          id: 'run-2',
          nodeId: 'node-2',
          boardId: 'board-1',
          status: 'queued',
          trigger: 'upstream',
          startedAt: new Date(),
          finishedAt: null,
          outputArrow: null,
          error: null,
        },
        duplicate: true,
        boardId: 'board-1',
        workspaceId: 'workspace-1',
      });

    const runProcessor = new RunProcessor(
      {
        markRunSucceeded,
        queueRun,
        markRunFailed: vi.fn(),
      } as any,
      10,
    );

    runProcessor.enqueue('run-1');
    await vi.runAllTimersAsync();

    expect(markRunSucceeded).toHaveBeenCalledWith('run-1');
    expect(queueRun).toHaveBeenCalled();
  });
});
