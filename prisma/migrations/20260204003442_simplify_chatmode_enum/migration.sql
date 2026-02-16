/*
  Warnings:

  - The values [NONE,QUESTION_GENERATE] on the enum `ChatMode` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ChatMode_new" AS ENUM ('STUDENT_ANSWER', 'STUDENT_QUESTION');
ALTER TABLE "public"."Task" ALTER COLUMN "mode" DROP DEFAULT;
ALTER TABLE "Task" ALTER COLUMN "mode" TYPE "ChatMode_new" USING ("mode"::text::"ChatMode_new");
ALTER TYPE "ChatMode" RENAME TO "ChatMode_old";
ALTER TYPE "ChatMode_new" RENAME TO "ChatMode";
DROP TYPE "public"."ChatMode_old";
ALTER TABLE "Task" ALTER COLUMN "mode" SET DEFAULT 'STUDENT_ANSWER';
COMMIT;
