-- DropIndex
DROP INDEX "Task_userId_finished_updatedAt_idx";

-- DropIndex
DROP INDEX "Task_userId_topicId_finished_updatedAt_idx";

-- DropIndex
DROP INDEX "idx_task_firsttask_lookup";

-- CreateIndex
CREATE INDEX "idx_topic_lateral_covering" ON "Topic"("sectionId", "partId", "id", "name", "type", "frequency");

-- CreateIndex
CREATE INDEX "idx_word_covering_percent" ON "Word"("userId", "subjectId", "totalAttemptCount", "totalCorrectCount", "frequency");
