-- CreateIndex
CREATE INDEX "idx_literature_subject_name" ON "Literature"("subjectId", "name");

-- CreateIndex
CREATE INDEX "idx_subtopic_cte_covering" ON "Subtopic"("subjectId", "detailLevel", "topicId", "sectionId");

-- CreateIndex
CREATE INDEX "idx_task_firsttask_lookup" ON "Task"("userId", "finished", "topicId", "updatedAt");

-- CreateIndex
CREATE INDEX "idx_usersection_update_target" ON "UserSection"("sectionId", "userId", "subjectId");

-- CreateIndex
CREATE INDEX "idx_usersubtopic_join_percent" ON "UserSubtopic"("subtopicId", "userId");

-- CreateIndex
CREATE INDEX "idx_usertopic_update_target" ON "UserTopic"("topicId", "userId", "subjectId");

-- CreateIndex
CREATE INDEX "idx_usertopic_currentpercents" ON "UserTopic"("userId", "subjectId");
