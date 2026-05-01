/*
  Warnings:

  - You are about to drop the column `chatPrompt` on the `Section` table. All the data in the column will be lost.
  - You are about to drop the column `chatPrompt` on the `Subject` table. All the data in the column will be lost.
  - You are about to drop the column `chatPrompt` on the `Topic` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Section" DROP COLUMN "chatPrompt",
ADD COLUMN     "chatAnswerPrompt" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "chatQuestionPrompt" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Subject" DROP COLUMN "chatPrompt",
ADD COLUMN     "chatAnswerPrompt" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "chatQuestionPrompt" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Topic" DROP COLUMN "chatPrompt",
ADD COLUMN     "chatAnswerPrompt" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "chatQuestionPrompt" TEXT NOT NULL DEFAULT '';
