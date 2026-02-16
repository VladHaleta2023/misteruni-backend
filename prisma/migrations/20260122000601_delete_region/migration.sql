/*
  Warnings:

  - You are about to drop the column `language` on the `Subject` table. All the data in the column will be lost.
  - You are about to drop the column `region` on the `Subject` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Subject" DROP COLUMN "language",
DROP COLUMN "region";
