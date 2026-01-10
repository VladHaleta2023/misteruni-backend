-- DropIndex
DROP INDEX "Subtopic_subjectId_sectionId_topicId_name_key";

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "minDetailLevel" "SubjectDetailLevel" NOT NULL DEFAULT 'MANDATORY';
