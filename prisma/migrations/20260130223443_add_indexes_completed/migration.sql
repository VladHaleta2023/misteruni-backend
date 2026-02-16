-- CreateIndex
CREATE INDEX "idx_topic_id_section_covering" ON "Topic"("id", "sectionId");

-- CreateIndex
CREATE INDEX "idx_usersubject_covering_threshold" ON "UserSubject"("userId", "subjectId", "threshold");
