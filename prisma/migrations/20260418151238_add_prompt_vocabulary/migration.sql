-- AlterTable
ALTER TABLE "Section" ADD COLUMN     "vocabularyGuidePrompt" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "vocabularyGuidePrompt" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Topic" ADD COLUMN     "vocabularyGuidePrompt" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Word" ADD COLUMN     "translate" TEXT NOT NULL DEFAULT '';
