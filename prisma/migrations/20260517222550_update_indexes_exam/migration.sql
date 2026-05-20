-- CreateIndex
CREATE INDEX "Exam_userId_subjectId_partId_idx" ON "Exam"("userId", "subjectId", "partId" DESC);

-- CreateIndex
CREATE INDEX "ExamTopic_examId_idx" ON "ExamTopic"("examId");

-- CreateIndex
CREATE INDEX "ExamTopic_topicId_idx" ON "ExamTopic"("topicId");

-- CreateIndex
CREATE INDEX "Subtopic_subjectId_detailLevel_partId_idx" ON "Subtopic"("subjectId", "detailLevel", "partId");

-- CreateIndex
CREATE INDEX "Task_examId_userId_finished_idx" ON "Task"("examId", "userId", "finished");

-- CreateIndex
CREATE INDEX "Task_examId_userId_subjectId_topicId_order_idx" ON "Task"("examId", "userId", "subjectId", "topicId", "order");

-- CreateIndex
CREATE INDEX "idx_task_exam_finished_filter" ON "Task"("examId", "finished");

-- CreateIndex
CREATE INDEX "Topic_subjectId_id_idx" ON "Topic"("subjectId", "id");

-- CreateIndex
CREATE INDEX "Topic_subjectId_type_frequency_idx" ON "Topic"("subjectId", "type", "frequency" DESC);

-- CreateIndex
CREATE INDEX "UserSubtopic_userId_subjectId_topicId_subtopicId_percent_idx" ON "UserSubtopic"("userId", "subjectId", "topicId", "subtopicId", "percent");
