-- AlterTable
ALTER TABLE "Section" ADD COLUMN     "subtopicsStatusPrompt" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "subtopicsStatusPrompt" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Topic" ADD COLUMN     "subtopicsStatusPrompt" TEXT NOT NULL DEFAULT '';
