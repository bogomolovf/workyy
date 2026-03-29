---
name: Key Implementation Patterns
description: Recurring patterns in the codebase — how to add nodes, routes, hooks, stores. Use when implementing new features
type: reference
---

# Key Implementation Patterns

## Adding a New Node Type

1. **core-domain**: Add to NodeType enum in `packages/core-domain/src/schemas/node.ts`
2. **Prisma**: Add to NodeType enum in `apps/realtime-server/prisma/schema.prisma`, run migration
3. **Frontend component**: Create `apps/web/src/components/flowNodes/MyNode.tsx`
4. **Register node**: Add to `nodeTypes` object in `BoardCanvas.tsx`
5. **Add to toolbar**: Update `useAddNode.ts` with `createMyNode()` factory
6. **Yjs adapters**: If custom payload, update `lib/yjs/adapters.ts` for serialization

## Adding a Backend API Route

1. **Route**: Create file in `apps/realtime-server/src/routes/myRoute.ts`
2. **Validator**: Create Zod schemas in `src/validators/myRoute.ts`
3. **Service** (if needed): Create in `src/services/myService.ts`
4. **Register**: Import and register in `src/routes/index.ts`
5. **Auth**: Use `preHandler: [fastify.authenticate]` for protected routes
6. **Access control**: Use `authorizationService.ensureBoardAccess()` or `ensureWorkspaceAccess()`

## Zustand Store Pattern

```typescript
import { create } from 'zustand';

interface MyStore {
  data: SomeType | null;
  setData: (data: SomeType) => void;
  reset: () => void;
}

export const useMyStore = create<MyStore>((set) => ({
  data: null,
  setData: (data) => set({ data }),
  reset: () => set({ data: null }),
}));
```

## Yjs Sync Hook Pattern

Hooks in `hooks/use*StateSynced.ts` follow this pattern:

1. Get Y.Map from shared Y.Doc (`useBoardCollaboration` provides ydoc)
2. Subscribe to Y.Map `observe` events
3. Convert Yjs data → React state on change
4. Write React changes back to Y.Map
5. Cleanup observer on unmount

## Fastify Route Pattern

```typescript
export async function myRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/my-endpoint',
    {
      schema: { querystring: mySchema },
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const validated = mySchema.parse(request.query);
      // ... logic
      return reply.send(result);
    },
  );
}
```

## Validator Pattern (Zod)

```typescript
import { z } from 'zod';

export const createMyThingSchema = z.object({
  name: z.string().min(1).max(255),
  boardId: z.string().uuid(),
  payload: z.record(z.unknown()).optional(),
});
export type CreateMyThingInput = z.infer<typeof createMyThingSchema>;
```

## Chart/Visualization Pipeline

1. Data flows: SqlNode/CsvNode → executionStore → PlotNode
2. PlotNode reads upstream via `useFullSqlDataForPlot` / `useFullCsvDataForPlot`
3. `dataAnalyzer.ts` auto-detects column types
4. `autoConfig.ts` suggests chart config
5. `chartBuilder.ts` generates ECharts option spec
6. `ChartRenderer.tsx` → `EChartsRenderer.tsx` renders

## Python Execution Flow

1. `pythonExecutor.ts` manages Worker pool
2. `python.worker.ts` loads Pyodide + packages (numpy, pandas, matplotlib, seaborn, plotly)
3. Worker intercepts `plotly.express` / `plotly.graph_objects` calls
4. Returns: stdout, stderr, plotly JSON, table data
5. Results stored in `executionStore`

## Comment System Pattern

- Backend: REST API in `routes/comments.ts`
- Frontend: `commentStore.ts` (Zustand) + `commentApi.ts` (fetch)
- Components: CommentLayer (positions) → CommentAnchor (dot) → CommentThreadCard (expanded)
- Threads anchored by (x, y) coordinates on canvas or by nodeId
