-- CreateTable
CREATE TABLE "BoardDataset" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "columns" JSONB NOT NULL,
    "fileData" BYTEA NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardDataset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BoardDataset_boardId_tableName_key" ON "BoardDataset"("boardId", "tableName");

-- AddForeignKey
ALTER TABLE "BoardDataset" ADD CONSTRAINT "BoardDataset_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;
