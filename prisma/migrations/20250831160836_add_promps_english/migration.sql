-- AlterTable
ALTER TABLE "public"."Section" ADD COLUMN     "subQuestionsPrompt" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "vocabluaryPrompt" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "public"."Subject" ADD COLUMN     "subQuestionsPrompt" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "vocabluaryPrompt" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "public"."Topic" ADD COLUMN     "subQuestionsPrompt" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "vocabluaryPrompt" TEXT NOT NULL DEFAULT '';
