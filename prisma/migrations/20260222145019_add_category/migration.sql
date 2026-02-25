/*
  Warnings:

  - You are about to drop the column `typePrompt` on the `Section` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Section" DROP COLUMN "typePrompt",
ADD COLUMN     "category" TEXT NOT NULL DEFAULT '';
