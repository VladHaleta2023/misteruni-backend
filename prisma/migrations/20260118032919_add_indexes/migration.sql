-- CreateIndex
CREATE INDEX "idx_section_subject_base" ON "Section"("subjectId");

-- CreateIndex
CREATE INDEX "idx_subtopic_subject_detail_importance" ON "Subtopic"("subjectId", "detailLevel", "importance");

-- CreateIndex
CREATE INDEX "idx_subtopic_topic_base" ON "Subtopic"("topicId");

-- CreateIndex
CREATE INDEX "idx_subtopic_subject_topic_detail_importance_id" ON "Subtopic"("subjectId", "topicId", "detailLevel", "importance", "id");

-- CreateIndex
CREATE INDEX "idx_topic_section_subject" ON "Topic"("sectionId", "subjectId");

-- CreateIndex
CREATE INDEX "idx_topic_subject_section_part_id" ON "Topic"("subjectId", "sectionId", "partId", "id");

-- CreateIndex
CREATE INDEX "idx_topic_subject_base" ON "Topic"("subjectId");

-- CreateIndex
CREATE INDEX "idx_usersection_user_subject_percent" ON "UserSection"("userId", "subjectId", "percent");

-- CreateIndex
CREATE INDEX "idx_usersection_user_subject_section_percent" ON "UserSection"("userId", "subjectId", "sectionId", "percent");

-- CreateIndex
CREATE INDEX "idx_usersubtopic_user_subject_percent" ON "UserSubtopic"("userId", "subjectId", "percent");

-- CreateIndex
CREATE INDEX "idx_usersubtopic_user_subject_subtopic_percent" ON "UserSubtopic"("userId", "subjectId", "subtopicId", "percent");

-- CreateIndex
CREATE INDEX "idx_usertopic_user_subject_percent" ON "UserTopic"("userId", "subjectId", "percent");

-- CreateIndex
CREATE INDEX "idx_usertopic_user_subject_topic_percent" ON "UserTopic"("userId", "subjectId", "topicId", "percent");
