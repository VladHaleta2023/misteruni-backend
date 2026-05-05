-- DropIndex
DROP INDEX "idx_task_firsttask_lookup";

-- CreateIndex
CREATE INDEX "idx_section_covering" ON "Section"("id", "subjectId", "partId", "type");

-- CreateIndex
CREATE INDEX "idx_subtopic_topic_section_detail" ON "Subtopic"("topicId", "sectionId", "subjectId", "detailLevel");

-- CreateIndex
CREATE INDEX "idx_topic_covering" ON "Topic"("sectionId", "id", "type", "name", "frequency");

-- CreateIndex
CREATE INDEX "idx_usersection_user_subject_section_full" ON "UserSection"("userId", "subjectId", "sectionId");

-- CreateIndex
CREATE INDEX "idx_task_firsttask_lookup" ON "Word"("userId", "subjectId", "finished", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "idx_word_user_subject_frequency" ON "Word"("userId", "subjectId", "frequency");

-- CreateIndex
CREATE INDEX "idx_word_percent_calc" ON "Word"("userId", "subjectId", "totalAttemptCount", "totalCorrectCount");
