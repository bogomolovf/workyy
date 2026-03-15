import { describe, expect, it } from 'vitest';
import { updateBoardContentSchema } from '../boards';

const validUuid = 'a1b2c3d4-e5f6-4780-9123-456789abcdef';

describe('updateBoardContentSchema', () => {
  it('accepts nodes with legacy type "voice"', () => {
    const result = updateBoardContentSchema.safeParse({
      nodes: [
        {
          id: validUuid,
          type: 'voice',
          position: { x: 0, y: 0 },
          payload: {},
        },
      ],
      edges: [],
    });
    expect(result.success).toBe(true);
  });

  it('accepts nodes with legacy types csv, video, document', () => {
    const result = updateBoardContentSchema.safeParse({
      nodes: [
        { id: 'a1b2c3d4-e5f6-4780-9123-456789abcdef', type: 'csv', position: { x: 0, y: 0 } },
        { id: 'b2c3d4e5-f6a7-4891-0234-56789abcdef0', type: 'video', position: { x: 10, y: 10 } },
        {
          id: 'c3d4e5f6-a7b8-4902-1345-6789abcdef01',
          type: 'document',
          position: { x: 20, y: 20 },
        },
      ],
      edges: [],
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown node type', () => {
    const result = updateBoardContentSchema.safeParse({
      nodes: [
        {
          id: validUuid,
          type: 'unknown_type',
          position: { x: 0, y: 0 },
        },
      ],
      edges: [],
    });
    expect(result.success).toBe(false);
  });
});
