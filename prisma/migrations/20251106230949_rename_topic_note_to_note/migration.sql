/*
  Warnings:

  - You are about to drop the column `topicNote` on the `Topic` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Topic" DROP COLUMN "topicNote",
ADD COLUMN     "note" TEXT NOT NULL DEFAULT '';
