-- AlterTable
ALTER TABLE "Section" ADD COLUMN     "wordsPrompt" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "wordsPrompt" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Topic" ADD COLUMN     "wordsPrompt" TEXT NOT NULL DEFAULT '';
