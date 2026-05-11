/*
  Warnings:

  - You are about to drop the column `mode` on the `Task` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Task" DROP COLUMN "mode";

-- DropEnum
DROP TYPE "ChatMode";
