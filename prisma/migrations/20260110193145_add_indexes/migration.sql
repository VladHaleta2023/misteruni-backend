/*
  Warnings:

  - Made the column `userId` on table `SubtopicProgress` required. This step will fail if there are existing NULL values in that column.
  - Made the column `userId` on table `Task` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "SubtopicProgress" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Task" ALTER COLUMN "userId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "AudioFile_taskId_idx" ON "AudioFile"("taskId");

-- CreateIndex
CREATE INDEX "Section_subjectId_type_idx" ON "Section"("subjectId", "type");

-- CreateIndex
CREATE INDEX "Subtopic_subjectId_detailLevel_idx" ON "Subtopic"("subjectId", "detailLevel");

-- CreateIndex
CREATE INDEX "Subtopic_subjectId_topicId_idx" ON "Subtopic"("subjectId", "topicId");

-- CreateIndex
CREATE INDEX "SubtopicProgress_userId_subtopicId_updatedAt_idx" ON "SubtopicProgress"("userId", "subtopicId", "updatedAt");

-- CreateIndex
CREATE INDEX "SubtopicProgress_userId_updatedAt_idx" ON "SubtopicProgress"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "SubtopicProgress_userId_percent_idx" ON "SubtopicProgress"("userId", "percent");

-- CreateIndex
CREATE INDEX "SubtopicProgress_userId_subtopicId_percent_idx" ON "SubtopicProgress"("userId", "subtopicId", "percent");

-- CreateIndex
CREATE INDEX "Task_userId_finished_updatedAt_idx" ON "Task"("userId", "finished", "updatedAt");

-- CreateIndex
CREATE INDEX "Task_userId_topicId_finished_updatedAt_idx" ON "Task"("userId", "topicId", "finished", "updatedAt");

-- CreateIndex
CREATE INDEX "Task_userId_finished_percent_idx" ON "Task"("userId", "finished", "percent");

-- CreateIndex
CREATE INDEX "Task_userId_parentTaskId_finished_idx" ON "Task"("userId", "parentTaskId", "finished");

-- CreateIndex
CREATE INDEX "TaskWord_taskId_idx" ON "TaskWord"("taskId");

-- CreateIndex
CREATE INDEX "TaskWord_wordId_idx" ON "TaskWord"("wordId");

-- CreateIndex
CREATE INDEX "Topic_subjectId_sectionId_idx" ON "Topic"("subjectId", "sectionId");

-- CreateIndex
CREATE INDEX "Topic_subjectId_frequency_idx" ON "Topic"("subjectId", "frequency");

-- CreateIndex
CREATE INDEX "Word_userId_subjectId_topicId_idx" ON "Word"("userId", "subjectId", "topicId");

-- CreateIndex
CREATE INDEX "Word_userId_finished_idx" ON "Word"("userId", "finished");

-- CreateIndex
CREATE INDEX "Word_userId_frequency_idx" ON "Word"("userId", "frequency");
