/*
  Warnings:

  - A unique constraint covering the columns `[subjectId,sectionId,topicId,name]` on the table `Subtopic` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE INDEX "Section_subjectId_partId_idx" ON "Section"("subjectId", "partId");

-- CreateIndex
CREATE INDEX "Subject_createdAt_idx" ON "Subject"("createdAt");

-- CreateIndex
CREATE INDEX "Subtopic_topicId_sectionId_subjectId_idx" ON "Subtopic"("topicId", "sectionId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "Subtopic_subjectId_sectionId_topicId_name_key" ON "Subtopic"("subjectId", "sectionId", "topicId", "name");

-- CreateIndex
CREATE INDEX "Topic_sectionId_partId_idx" ON "Topic"("sectionId", "partId");
