-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "examSheetId" INTEGER;

-- CreateTable
CREATE TABLE "ExamSheet" (
    "id" SERIAL NOT NULL,
    "userSubjectId" INTEGER NOT NULL,
    "partId" INTEGER NOT NULL DEFAULT -1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamSheetTopic" (
    "examSheetId" INTEGER NOT NULL,
    "topicId" INTEGER NOT NULL,

    CONSTRAINT "ExamSheetTopic_pkey" PRIMARY KEY ("examSheetId","topicId")
);

-- AddForeignKey
ALTER TABLE "ExamSheet" ADD CONSTRAINT "ExamSheet_userSubjectId_fkey" FOREIGN KEY ("userSubjectId") REFERENCES "UserSubject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSheetTopic" ADD CONSTRAINT "ExamSheetTopic_examSheetId_fkey" FOREIGN KEY ("examSheetId") REFERENCES "ExamSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSheetTopic" ADD CONSTRAINT "ExamSheetTopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_examSheetId_fkey" FOREIGN KEY ("examSheetId") REFERENCES "ExamSheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
