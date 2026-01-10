/*
  Warnings:

  - A unique constraint covering the columns `[userId,subjectId,text]` on the table `Word` will be added. If there are existing duplicate values, this will fail.
  - Made the column `userId` on table `Word` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "Word_text_userId_key";

-- AlterTable
ALTER TABLE "Word" ADD COLUMN     "subjectId" INTEGER,
ALTER COLUMN "userId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Word_userId_topicId_idx" ON "Word"("userId", "topicId");

-- CreateIndex
CREATE INDEX "Word_userId_subjectId_idx" ON "Word"("userId", "subjectId");

-- CreateIndex
CREATE INDEX "Word_text_idx" ON "Word"("text");

-- CreateIndex
CREATE UNIQUE INDEX "Word_userId_subjectId_text_key" ON "Word"("userId", "subjectId", "text");

-- AddForeignKey
ALTER TABLE "Word" ADD CONSTRAINT "Word_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
