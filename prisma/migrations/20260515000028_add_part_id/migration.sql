/*
  Warnings:

  - Added the required column `partId` to the `ExamTopic` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ExamTopic" ADD COLUMN     "partId" INTEGER NOT NULL;
