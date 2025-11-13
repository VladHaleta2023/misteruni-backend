/*
  Warnings:

  - You are about to drop the column `blocked` on the `Section` table. All the data in the column will be lost.
  - You are about to drop the column `blocked` on the `Subtopic` table. All the data in the column will be lost.
  - You are about to drop the column `blocked` on the `Topic` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Section" DROP COLUMN "blocked";

-- AlterTable
ALTER TABLE "Subtopic" DROP COLUMN "blocked";

-- AlterTable
ALTER TABLE "Topic" DROP COLUMN "blocked";
