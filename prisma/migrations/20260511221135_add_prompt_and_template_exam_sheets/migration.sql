-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "examSheetPrompt" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "examSheetTemplates" TEXT NOT NULL DEFAULT '';
