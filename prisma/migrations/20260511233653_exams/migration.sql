/*
  Warnings:

  - You are about to drop the column `examSheetPrompt` on the `Subject` table. All the data in the column will be lost.
  - You are about to drop the column `examSheetTemplates` on the `Subject` table. All the data in the column will be lost.
  - You are about to drop the column `examSheetId` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the `ExamSheet` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ExamSheetTopic` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ExamSheet" DROP CONSTRAINT "ExamSheet_subjectId_fkey";

-- DropForeignKey
ALTER TABLE "ExamSheet" DROP CONSTRAINT "ExamSheet_userId_fkey";

-- DropForeignKey
ALTER TABLE "ExamSheetTopic" DROP CONSTRAINT "ExamSheetTopic_examSheetId_fkey";

-- DropForeignKey
ALTER TABLE "ExamSheetTopic" DROP CONSTRAINT "ExamSheetTopic_topicId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_examSheetId_fkey";

-- AlterTable
ALTER TABLE "Subject" DROP COLUMN "examSheetPrompt",
DROP COLUMN "examSheetTemplates",
ADD COLUMN     "examPrompt" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "examTemplates" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "examSheetId",
ADD COLUMN     "examId" INTEGER;

-- DropTable
DROP TABLE "ExamSheet";

-- DropTable
DROP TABLE "ExamSheetTopic";

-- CreateTable
CREATE TABLE "Exam" (
    "id" SERIAL NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "partId" INTEGER NOT NULL DEFAULT -1,
    "timeSpentSeconds" INTEGER NOT NULL DEFAULT 10800,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamTopic" (
    "examId" INTEGER NOT NULL,
    "topicId" INTEGER NOT NULL,

    CONSTRAINT "ExamTopic_pkey" PRIMARY KEY ("examId","topicId")
);

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamTopic" ADD CONSTRAINT "ExamTopic_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamTopic" ADD CONSTRAINT "ExamTopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
