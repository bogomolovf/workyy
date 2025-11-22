import { randomUUID } from 'crypto';
import { RunService } from '../services/runService';

export class RunProcessor {
  private readonly inflight = new Set<string>();

  constructor(private readonly runService: RunService, private readonly delayMs = 200) {}

  enqueue(runId: string) {
    if (this.inflight.has(runId)) {
      return;
    }

    this.inflight.add(runId);
    setTimeout(async () => {
      try {
        const { downstreamNodeIds } = await this.runService.markRunSucceeded(runId);
        this.inflight.delete(runId);

        for (const nodeId of downstreamNodeIds) {
          const result = await this.runService.queueRun({
            nodeId,
            trigger: 'upstream',
            idempotencyKey: `auto:${runId}:${nodeId}:${randomUUID()}`,
          });
          if (!result.duplicate) {
            this.enqueue(result.run.id);
          }
        }
      } catch (error) {
        await this.runService.markRunFailed(runId, (error as Error).message);
        this.inflight.delete(runId);
      }
    }, this.delayMs);
  }
}

