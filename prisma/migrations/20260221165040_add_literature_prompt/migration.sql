-- AlterTable
ALTER TABLE "Section" ADD COLUMN     "literaturePrompt" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "literaturePrompt" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Topic" ADD COLUMN     "literaturePrompt" TEXT NOT NULL DEFAULT '';
