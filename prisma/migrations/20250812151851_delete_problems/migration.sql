/*
  Warnings:

  - You are about to drop the column `closedProblemsPrompt` on the `Section` table. All the data in the column will be lost.
  - You are about to drop the column `newProblemsPrompt` on the `Section` table. All the data in the column will be lost.
  - You are about to drop the column `closedProblemsPrompt` on the `Subject` table. All the data in the column will be lost.
  - You are about to drop the column `newProblemsPrompt` on the `Subject` table. All the data in the column will be lost.
  - You are about to drop the column `closedProblems` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `completed` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `newProblems` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `closedProblemsPrompt` on the `Topic` table. All the data in the column will be lost.
  - You are about to drop the column `newProblemsPrompt` on the `Topic` table. All the data in the column will be lost.
  - You are about to drop the `Problem` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Problem" DROP CONSTRAINT "Problem_topicId_fkey";

-- AlterTable
ALTER TABLE "public"."Section" DROP COLUMN "closedProblemsPrompt",
DROP COLUMN "newProblemsPrompt";

-- AlterTable
ALTER TABLE "public"."Subject" DROP COLUMN "closedProblemsPrompt",
DROP COLUMN "newProblemsPrompt";

-- AlterTable
ALTER TABLE "public"."Task" DROP COLUMN "closedProblems",
DROP COLUMN "completed",
DROP COLUMN "newProblems";

-- AlterTable
ALTER TABLE "public"."Topic" DROP COLUMN "closedProblemsPrompt",
DROP COLUMN "newProblemsPrompt";

-- DropTable
DROP TABLE "public"."Problem";
