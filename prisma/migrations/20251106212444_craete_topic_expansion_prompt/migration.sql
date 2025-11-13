-- AlterTable
ALTER TABLE "Section" ADD COLUMN     "topicExpansionPrompt" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "topicExpansionPrompt" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Topic" ADD COLUMN     "topicExpansionPrompt" TEXT NOT NULL DEFAULT '';
