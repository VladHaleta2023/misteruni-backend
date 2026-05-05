/*
  Warnings:

  - You are about to drop the column `chatAnswerPrompt` on the `Section` table. All the data in the column will be lost.
  - You are about to drop the column `chatQuestionPrompt` on the `Section` table. All the data in the column will be lost.
  - You are about to drop the column `chatAnswerPrompt` on the `Subject` table. All the data in the column will be lost.
  - You are about to drop the column `chatQuestionPrompt` on the `Subject` table. All the data in the column will be lost.
  - You are about to drop the column `chatAnswerPrompt` on the `Topic` table. All the data in the column will be lost.
  - You are about to drop the column `chatQuestionPrompt` on the `Topic` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Section" DROP COLUMN "chatAnswerPrompt",
DROP COLUMN "chatQuestionPrompt",
ADD COLUMN     "chatPrompt" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Subject" DROP COLUMN "chatAnswerPrompt",
DROP COLUMN "chatQuestionPrompt",
ADD COLUMN     "chatPrompt" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Topic" DROP COLUMN "chatAnswerPrompt",
DROP COLUMN "chatQuestionPrompt",
ADD COLUMN     "chatPrompt" TEXT NOT NULL DEFAULT '';
