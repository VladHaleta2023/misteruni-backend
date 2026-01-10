-- CreateIndex
CREATE INDEX "Subtopic_topicId_detailLevel_idx" ON "Subtopic"("topicId", "detailLevel");

-- CreateIndex
CREATE INDEX "Subtopic_subjectId_sectionId_topicId_detailLevel_idx" ON "Subtopic"("subjectId", "sectionId", "topicId", "detailLevel");

-- CreateIndex
CREATE INDEX "SubtopicProgress_userId_subtopicId_idx" ON "SubtopicProgress"("userId", "subtopicId");

-- CreateIndex
CREATE INDEX "SubtopicProgress_taskId_userId_idx" ON "SubtopicProgress"("taskId", "userId");

-- CreateIndex
CREATE INDEX "SubtopicProgress_subtopicId_userId_idx" ON "SubtopicProgress"("subtopicId", "userId");

-- CreateIndex
CREATE INDEX "Task_userId_topicId_finished_idx" ON "Task"("userId", "topicId", "finished");

-- CreateIndex
CREATE INDEX "Task_userId_parentTaskId_idx" ON "Task"("userId", "parentTaskId");

-- CreateIndex
CREATE INDEX "Task_topicId_userId_idx" ON "Task"("topicId", "userId");

-- CreateIndex
CREATE INDEX "UserSubject_userId_detailLevel_idx" ON "UserSubject"("userId", "detailLevel");
