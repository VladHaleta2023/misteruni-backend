-- AlterTable
ALTER TABLE "Section" ADD COLUMN     "topicFrequencyPrompt" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "topicFrequencyPrompt" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Subtopic" ADD COLUMN     "partId" INTEGER NOT NULL DEFAULT -1;

-- AlterTable
ALTER TABLE "Topic" ADD COLUMN     "topicFrequencyPrompt" TEXT NOT NULL DEFAULT '';
