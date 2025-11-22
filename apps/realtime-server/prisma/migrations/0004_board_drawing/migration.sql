-- CreateTable
CREATE TABLE "BoardDrawing" (
    "boardId" UUID PRIMARY KEY REFERENCES "Board"("id") ON DELETE CASCADE,
    "snapshot" JSONB NOT NULL,
    "rev" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

