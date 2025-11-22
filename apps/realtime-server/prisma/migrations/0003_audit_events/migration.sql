-- AlterTable
ALTER TABLE "RunRequest" ADD COLUMN "inputs" JSONB;

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "boardId" UUID,
    "workspaceId" UUID,
    "runId" UUID,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "AuditEvent_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AuditEvent_boardId_createdAt_idx" ON "AuditEvent" ("boardId", "createdAt" DESC);
CREATE INDEX "AuditEvent_workspaceId_createdAt_idx" ON "AuditEvent" ("workspaceId", "createdAt" DESC);
CREATE INDEX "AuditEvent_runId_createdAt_idx" ON "AuditEvent" ("runId", "createdAt" DESC);

