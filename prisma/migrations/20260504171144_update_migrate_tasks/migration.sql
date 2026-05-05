/*
  Warnings:

  - Added the required column `subjectId` to the `Task` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Task_userId_topicId_finished_idx";

-- DropIndex
DROP INDEX "idx_usertopic_currentpercents";

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "subjectId" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "Task_userId_subjectId_finished_updatedAt_idx" ON "Task"("userId", "subjectId", "finished", "updatedAt");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
