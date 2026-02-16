-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'PL';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "chatFinished" BOOLEAN NOT NULL DEFAULT false;
