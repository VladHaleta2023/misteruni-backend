/*
  Warnings:

  - You are about to drop the column `topicNote` on the `Task` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Task" DROP COLUMN "topicNote";

-- AlterTable
ALTER TABLE "Topic" ADD COLUMN     "frequency" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "topicNote" TEXT NOT NULL DEFAULT '';
