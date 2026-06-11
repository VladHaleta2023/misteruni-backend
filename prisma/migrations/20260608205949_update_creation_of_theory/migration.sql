-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "theoryPrompt" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "theoryFinished" BOOLEAN NOT NULL DEFAULT false;
