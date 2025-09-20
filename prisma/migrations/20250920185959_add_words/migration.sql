/*
  Warnings:

  - You are about to drop the column `translate` on the `Word` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[text]` on the table `Word` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Word_text_taskId_key";

-- AlterTable
ALTER TABLE "public"."Word" DROP COLUMN "translate";

-- CreateIndex
CREATE UNIQUE INDEX "Word_text_key" ON "public"."Word"("text");
