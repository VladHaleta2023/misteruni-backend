/*
  Warnings:

  - Added the required column `updatedAt` to the `Statistic` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Statistic" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "Statistic_userId_subjectId_updatedAt_idx" ON "Statistic"("userId", "subjectId", "updatedAt" DESC);
