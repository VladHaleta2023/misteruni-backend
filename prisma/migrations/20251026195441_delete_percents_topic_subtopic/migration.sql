/*
  Warnings:

  - You are about to drop the column `percent` on the `Subtopic` table. All the data in the column will be lost.
  - You are about to drop the column `percent` on the `Topic` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Subtopic" DROP COLUMN "percent";

-- AlterTable
ALTER TABLE "Topic" DROP COLUMN "percent";
