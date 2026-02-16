-- CreateIndex
CREATE INDEX "idx_subtopic_performance_main" ON "Subtopic"("subjectId", "sectionId", "topicId", "detailLevel", "id");

-- CreateIndex
CREATE INDEX "idx_subtopic_covering_all" ON "Subtopic"("topicId", "sectionId", "subjectId", "detailLevel", "id", "name", "importance");

-- CreateIndex
CREATE INDEX "idx_subtopic_covering_filter" ON "Subtopic"("subjectId", "sectionId", "topicId", "detailLevel", "id", "name", "importance");

-- CreateIndex
CREATE INDEX "idx_subtopicprogress_covering_task" ON "SubtopicProgress"("userId", "subtopicId", "taskId");

-- CreateIndex
CREATE INDEX "idx_task_id_fast" ON "Task"("id");

-- CreateIndex
CREATE INDEX "idx_task_covering_main" ON "Task"("id", "text", "percent", "updatedAt");

-- CreateIndex
CREATE INDEX "idx_usersubtopic_user_subject_subtopic_fast" ON "UserSubtopic"("userId", "subjectId", "subtopicId");

-- CreateIndex
CREATE INDEX "idx_usertopic_user_subject_topic_fast" ON "UserTopic"("userId", "subjectId", "topicId");
