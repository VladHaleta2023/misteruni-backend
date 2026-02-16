-- CreateIndex
CREATE INDEX "idx_subtopicprogress_task_user_subtopic" ON "SubtopicProgress"("taskId", "userId", "subtopicId");

-- CreateIndex
CREATE INDEX "idx_task_user_topic_finished_order" ON "Task"("userId", "topicId", "finished", "parentTaskId", "order");
