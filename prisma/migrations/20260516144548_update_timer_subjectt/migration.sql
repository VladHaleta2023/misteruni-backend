/*
  Warnings:

  - You are about to drop the column `totalTimeSpentSeconds` on the `Subject` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Subject" DROP COLUMN "totalTimeSpentSeconds",
ADD COLUMN     "totalTimeSpent" INTEGER NOT NULL DEFAULT 0;
