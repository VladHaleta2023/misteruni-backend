-- DropIndex
DROP INDEX "Topic_subjectId_frequency_idx";

-- RenameIndex
ALTER INDEX "Section_subjectId_partId_id_idx" RENAME TO "idx_section_subject_part_id";

-- RenameIndex
ALTER INDEX "Section_subjectId_partId_idx" RENAME TO "idx_section_subject_part";

-- RenameIndex
ALTER INDEX "Section_subjectId_type_idx" RENAME TO "idx_section_subject_type";

-- RenameIndex
ALTER INDEX "Subject_createdAt_idx" RENAME TO "idx_subject_createdAt";

-- RenameIndex
ALTER INDEX "Topic_sectionId_partId_idx" RENAME TO "idx_topic_section_part";

-- RenameIndex
ALTER INDEX "Topic_subjectId_sectionId_id_idx" RENAME TO "idx_topic_subject_section_id";

-- RenameIndex
ALTER INDEX "Topic_subjectId_sectionId_idx" RENAME TO "idx_topic_subject_section";

-- RenameIndex
ALTER INDEX "UserSection_subjectId_sectionId_idx" RENAME TO "idx_usersection_subject_section";

-- RenameIndex
ALTER INDEX "UserSection_userId_sectionId_idx" RENAME TO "idx_usersection_user_section";

-- RenameIndex
ALTER INDEX "UserSection_userId_subjectId_idx" RENAME TO "idx_usersection_user_subject";

-- RenameIndex
ALTER INDEX "UserSubject_detailLevel_idx" RENAME TO "idx_usersubject_detailLevel";

-- RenameIndex
ALTER INDEX "UserSubject_userId_detailLevel_idx" RENAME TO "idx_usersubject_user_detail";

-- RenameIndex
ALTER INDEX "UserSubtopic_sectionId_topicId_subtopicId_idx" RENAME TO "idx_usersubtopic_section_topic_subtopic";

-- RenameIndex
ALTER INDEX "UserSubtopic_subjectId_topicId_subtopicId_idx" RENAME TO "idx_usersubtopic_subject_topic_subtopic";

-- RenameIndex
ALTER INDEX "UserSubtopic_userId_subjectId_sectionId_idx" RENAME TO "idx_usersubtopic_user_subject_section";

-- RenameIndex
ALTER INDEX "UserSubtopic_userId_subjectId_topicId_idx" RENAME TO "idx_usersubtopic_user_subject_topic";

-- RenameIndex
ALTER INDEX "UserSubtopic_userId_subtopicId_idx" RENAME TO "idx_usersubtopic_user_subtopic";

-- RenameIndex
ALTER INDEX "UserTopic_sectionId_topicId_idx" RENAME TO "idx_usertopic_section_topic";

-- RenameIndex
ALTER INDEX "UserTopic_subjectId_topicId_idx" RENAME TO "idx_usertopic_subject_topic";

-- RenameIndex
ALTER INDEX "UserTopic_userId_subjectId_sectionId_idx" RENAME TO "idx_usertopic_user_subject_section";

-- RenameIndex
ALTER INDEX "UserTopic_userId_topicId_idx" RENAME TO "idx_usertopic_user_topic";
