/*
  Warnings:

  - You are about to drop the column `userSubjectId` on the `ExamSheet` table. All the data in the column will be lost.
  - Added the required column `subjectId` to the `ExamSheet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `ExamSheet` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ExamSheet" DROP CONSTRAINT "ExamSheet_userSubjectId_fkey";

-- AlterTable
ALTER TABLE "ExamSheet" DROP COLUMN "userSubjectId",
ADD COLUMN     "subjectId" INTEGER NOT NULL,
ADD COLUMN     "userId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "ExamSheet" ADD CONSTRAINT "ExamSheet_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSheet" ADD CONSTRAINT "ExamSheet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
