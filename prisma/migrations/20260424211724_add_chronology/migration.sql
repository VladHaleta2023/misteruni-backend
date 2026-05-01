-- AlterTable
ALTER TABLE "Section" ADD COLUMN     "chronologyPrompt" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "chronologyPrompt" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Topic" ADD COLUMN     "chronologyPrompt" TEXT NOT NULL DEFAULT '';
