/*
  Warnings:

  - You are about to drop the column `subQuestionsPrompt` on the `Section` table. All the data in the column will be lost.
  - You are about to drop the column `subQuestionsPrompt` on the `Subject` table. All the data in the column will be lost.
  - You are about to drop the column `subQuestionsPrompt` on the `Topic` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Section" DROP COLUMN "subQuestionsPrompt";

-- AlterTable
ALTER TABLE "Subject" DROP COLUMN "subQuestionsPrompt";

-- AlterTable
ALTER TABLE "Topic" DROP COLUMN "subQuestionsPrompt";
