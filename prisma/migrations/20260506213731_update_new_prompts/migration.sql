-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "audioChatPrompt" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "audioClosedPrompt" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "audioQuestionPrompt" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "writingClosedPrompt" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "writingQuestionPrompt" TEXT NOT NULL DEFAULT '';
