-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('owner', 'editor', 'viewer');

-- CreateEnum
CREATE TYPE "NodeType" AS ENUM ('sql', 'python', 'table', 'plot');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "RunTrigger" AS ENUM ('manual', 'upstream', 'schedule');

-- CreateEnum
CREATE TYPE "RetentionType" AS ENUM ('board', 'run', 'snapshot');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL UNIQUE,
    "name" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CreateTable
CREATE TABLE "UserWorkspaceRole" (
    "userId" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "role" "WorkspaceRole" NOT NULL,
    "addedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY ("userId", "workspaceId"),
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Board" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "workspaceId" UUID NOT NULL,
    "ownerId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "snapshotCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE ("workspaceId", "title"),
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Node" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "boardId" UUID NOT NULL,
    "type" "NodeType" NOT NULL,
    "positionX" DOUBLE PRECISION NOT NULL,
    "positionY" DOUBLE PRECISION NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY ("boardId") REFERENCES "Board" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Edge" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "boardId" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "targetId" UUID NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE ("sourceId", "targetId"),
    FOREIGN KEY ("boardId") REFERENCES "Board" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("sourceId") REFERENCES "Node" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("targetId") REFERENCES "Node" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Run" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "nodeId" UUID NOT NULL,
    "boardId" UUID NOT NULL,
    "status" "RunStatus" NOT NULL,
    "trigger" "RunTrigger" NOT NULL,
    "startedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "finishedAt" TIMESTAMPTZ,
    "outputArrow" BYTEA,
    "error" TEXT,
    FOREIGN KEY ("nodeId") REFERENCES "Node" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("boardId") REFERENCES "Board" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "boardId" UUID NOT NULL,
    "createdBy" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "metadata" JSONB,
    "arrowBlob" BYTEA NOT NULL,
    FOREIGN KEY ("boardId") REFERENCES "Board" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "boardId" UUID NOT NULL,
    "nodeId" UUID,
    "authorId" UUID,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY ("boardId") REFERENCES "Board" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("nodeId") REFERENCES "Node" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Secret" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE ("workspaceId", "name"),
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RetentionPolicy" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "workspaceId" UUID NOT NULL,
    "boardId" UUID,
    "type" "RetentionType" NOT NULL,
    "ttlDays" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("boardId") REFERENCES "Board" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes
CREATE INDEX "Comment_boardId_nodeId_idx" ON "Comment" ("boardId", "nodeId");
CREATE INDEX "Run_nodeId_status_startedAt_idx" ON "Run" ("nodeId", "status", "startedAt" DESC);


