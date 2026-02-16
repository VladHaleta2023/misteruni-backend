/*
  Warnings:

  - You are about to drop the column `note` on the `Task` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ChatMode" AS ENUM ('NONE', 'QUESTION_GENERATE', 'STUDENT_ANSWER', 'STUDENT_QUESTION');

-- AlterTable
ALTER TABLE "Section" ADD COLUMN     "chatPrompt" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "chatPrompt" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "region" TEXT NOT NULL DEFAULT 'PL';

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "note",
ADD COLUMN     "mode" "ChatMode" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "Topic" ADD COLUMN     "chatPrompt" TEXT NOT NULL DEFAULT '';
