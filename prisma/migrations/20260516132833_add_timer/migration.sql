/*
  Warnings:

  - You are about to drop the column `timeSpentSeconds` on the `Exam` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Exam" DROP COLUMN "timeSpentSeconds";

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "totalTimeSpentSeconds" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "timeSpentSeconds" INTEGER NOT NULL DEFAULT 0;
