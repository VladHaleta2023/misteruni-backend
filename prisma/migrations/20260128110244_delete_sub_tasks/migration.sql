/*
  Warnings:

  - You are about to drop the column `parentTaskId` on the `Task` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_parentTaskId_fkey";

-- DropIndex
DROP INDEX "Task_userId_parentTaskId_finished_idx";

-- DropIndex
DROP INDEX "Task_userId_parentTaskId_idx";

-- DropIndex
DROP INDEX "idx_task_user_topic_finished_order";

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "parentTaskId";

-- CreateIndex
CREATE INDEX "idx_task_user_topic_finished_order" ON "Task"("userId", "topicId", "finished", "order");
