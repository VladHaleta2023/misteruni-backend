-- CreateIndex
CREATE INDEX "Section_subjectId_partId_id_idx" ON "Section"("subjectId", "partId", "id");

-- CreateIndex
CREATE INDEX "idx_subtopic_subject_topic_detail_id" ON "Subtopic"("subjectId", "topicId", "detailLevel", "id");

-- CreateIndex
CREATE INDEX "Topic_subjectId_sectionId_id_idx" ON "Topic"("subjectId", "sectionId", "id");

-- CreateIndex
CREATE INDEX "UserSection_userId_sectionId_idx" ON "UserSection"("userId", "sectionId");

-- CreateIndex
CREATE INDEX "UserSection_subjectId_sectionId_idx" ON "UserSection"("subjectId", "sectionId");

-- CreateIndex
CREATE INDEX "UserSubtopic_userId_subtopicId_idx" ON "UserSubtopic"("userId", "subtopicId");

-- CreateIndex
CREATE INDEX "UserSubtopic_subjectId_topicId_subtopicId_idx" ON "UserSubtopic"("subjectId", "topicId", "subtopicId");

-- CreateIndex
CREATE INDEX "UserSubtopic_sectionId_topicId_subtopicId_idx" ON "UserSubtopic"("sectionId", "topicId", "subtopicId");

-- CreateIndex
CREATE INDEX "UserTopic_userId_topicId_idx" ON "UserTopic"("userId", "topicId");

-- CreateIndex
CREATE INDEX "UserTopic_subjectId_topicId_idx" ON "UserTopic"("subjectId", "topicId");

-- CreateIndex
CREATE INDEX "UserTopic_sectionId_topicId_idx" ON "UserTopic"("sectionId", "topicId");

-- RenameIndex
ALTER INDEX "Subtopic_subjectId_detailLevel_idx" RENAME TO "idx_subtopic_subject_detail_1";

-- RenameIndex
ALTER INDEX "Subtopic_subjectId_sectionId_topicId_detailLevel_idx" RENAME TO "idx_subtopic_subject_section_topic_detail";

-- RenameIndex
ALTER INDEX "Subtopic_subjectId_topicId_idx" RENAME TO "idx_subtopic_subject_topic";

-- RenameIndex
ALTER INDEX "Subtopic_topicId_detailLevel_idx" RENAME TO "idx_subtopic_topic_detail";

-- RenameIndex
ALTER INDEX "Subtopic_topicId_sectionId_subjectId_idx" RENAME TO "idx_subtopic_topic_section_subject";
