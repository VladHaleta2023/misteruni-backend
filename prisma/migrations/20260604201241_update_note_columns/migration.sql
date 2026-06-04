/*
  Warnings:

  - You are about to drop the column `note` on the `Topic` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Topic" DROP COLUMN "note",
ADD COLUMN     "noteBasicLevel" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "noteExpandedLevel" TEXT NOT NULL DEFAULT '';
