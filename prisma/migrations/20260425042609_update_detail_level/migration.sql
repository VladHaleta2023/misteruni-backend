/*
  Warnings:

  - The values [MANDATORY,DESIRABLE,OPTIONAL] on the enum `SubjectDetailLevel` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "SubjectDetailLevel_new" AS ENUM ('BASIC', 'EXPANDED', 'ACADEMIC');
ALTER TABLE "public"."Subject" ALTER COLUMN "minDetailLevel" DROP DEFAULT;
ALTER TABLE "public"."Subtopic" ALTER COLUMN "detailLevel" DROP DEFAULT;
ALTER TABLE "public"."UserSubject" ALTER COLUMN "detailLevel" DROP DEFAULT;
ALTER TABLE "Subject" ALTER COLUMN "minDetailLevel" TYPE "SubjectDetailLevel_new" USING ("minDetailLevel"::text::"SubjectDetailLevel_new");
ALTER TABLE "UserSubject" ALTER COLUMN "detailLevel" TYPE "SubjectDetailLevel_new" USING ("detailLevel"::text::"SubjectDetailLevel_new");
ALTER TABLE "Subtopic" ALTER COLUMN "detailLevel" TYPE "SubjectDetailLevel_new" USING ("detailLevel"::text::"SubjectDetailLevel_new");
ALTER TYPE "SubjectDetailLevel" RENAME TO "SubjectDetailLevel_old";
ALTER TYPE "SubjectDetailLevel_new" RENAME TO "SubjectDetailLevel";
DROP TYPE "public"."SubjectDetailLevel_old";
ALTER TABLE "Subject" ALTER COLUMN "minDetailLevel" SET DEFAULT 'BASIC';
ALTER TABLE "Subtopic" ALTER COLUMN "detailLevel" SET DEFAULT 'BASIC';
ALTER TABLE "UserSubject" ALTER COLUMN "detailLevel" SET DEFAULT 'BASIC';
COMMIT;

-- AlterTable
ALTER TABLE "Subject" ALTER COLUMN "minDetailLevel" SET DEFAULT 'BASIC';

-- AlterTable
ALTER TABLE "Subtopic" ALTER COLUMN "detailLevel" SET DEFAULT 'BASIC';

-- AlterTable
ALTER TABLE "UserSubject" ALTER COLUMN "detailLevel" SET DEFAULT 'BASIC';
