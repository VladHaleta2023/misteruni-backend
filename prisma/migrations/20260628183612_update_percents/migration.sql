/*
  Warnings:

  - You are about to drop the column `percentAudio` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `percentWords` on the `Task` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Task" DROP COLUMN "percentAudio",
DROP COLUMN "percentWords";
