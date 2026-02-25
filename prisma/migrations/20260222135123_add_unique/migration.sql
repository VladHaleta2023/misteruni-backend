/*
  Warnings:

  - A unique constraint covering the columns `[userId,subjectId,text]` on the table `Word` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Word_userId_subjectId_text_key" ON "Word"("userId", "subjectId", "text");
