-- AlterTable
ALTER TABLE "Section" ADD COLUMN     "solutionGuidePrompt" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "solutionGuidePrompt" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "solutionGuide" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Topic" ADD COLUMN     "solutionGuidePrompt" TEXT NOT NULL DEFAULT '';
