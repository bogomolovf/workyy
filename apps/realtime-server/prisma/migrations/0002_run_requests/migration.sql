-- CreateEnum
CREATE TYPE "RunRequestStatus" AS ENUM ('pending', 'completed', 'duplicate');

-- CreateTable
CREATE TABLE "RunRequest" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "boardId" UUID NOT NULL,
    "nodeId" UUID NOT NULL,
    "idempotencyKey" TEXT NOT NULL UNIQUE,
    "status" "RunRequestStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "runId" UUID UNIQUE,
    FOREIGN KEY ("boardId") REFERENCES "Board" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("nodeId") REFERENCES "Node" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("runId") REFERENCES "Run" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RunRequest_boardId_nodeId_createdAt_idx" ON "RunRequest" ("boardId", "nodeId", "createdAt");

