-- AlterTable: add backgroundUrl to TaskTracker
ALTER TABLE "TaskTracker" ADD COLUMN "backgroundUrl" TEXT;

-- CreateTable: TaskActivity
CREATE TABLE "TaskActivity" (
    "id" TEXT NOT NULL,
    "trackerId" TEXT NOT NULL,
    "taskId" TEXT,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskActivity_taskId_createdAt_idx" ON "TaskActivity"("taskId", "createdAt");
CREATE INDEX "TaskActivity_trackerId_createdAt_idx" ON "TaskActivity"("trackerId", "createdAt");

-- AddForeignKey
ALTER TABLE "TaskActivity" ADD CONSTRAINT "TaskActivity_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "TaskTracker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskActivity" ADD CONSTRAINT "TaskActivity_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskActivity" ADD CONSTRAINT "TaskActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
