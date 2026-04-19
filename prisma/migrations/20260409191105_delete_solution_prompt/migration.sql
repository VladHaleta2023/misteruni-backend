/*
  Warnings:

  - You are about to drop the column `solutionPrompt` on the `Section` table. All the data in the column will be lost.
  - You are about to drop the column `solutionPrompt` on the `Subject` table. All the data in the column will be lost.
  - You are about to drop the column `solutionPrompt` on the `Topic` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Section" DROP COLUMN "solutionPrompt";

-- AlterTable
ALTER TABLE "Subject" DROP COLUMN "solutionPrompt";

-- AlterTable
ALTER TABLE "Topic" DROP COLUMN "solutionPrompt";
