/*
  Warnings:

  - You are about to drop the column `durationMinutes` on the `ExamSheet` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ExamSheet" DROP COLUMN "durationMinutes",
ADD COLUMN     "timeSpentSeconds" INTEGER NOT NULL DEFAULT 10800;
