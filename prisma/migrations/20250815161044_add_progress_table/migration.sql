/*
  Warnings:

  - You are about to drop the column `percent` on the `Subtopic` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Subtopic" DROP COLUMN "percent";

-- CreateTable
CREATE TABLE "public"."SubtopicProgress" (
    "id" SERIAL NOT NULL,
    "percent" INTEGER NOT NULL DEFAULT 0,
    "subtopicId" INTEGER NOT NULL,
    "taskId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubtopicProgress_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."SubtopicProgress" ADD CONSTRAINT "SubtopicProgress_subtopicId_fkey" FOREIGN KEY ("subtopicId") REFERENCES "public"."Subtopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SubtopicProgress" ADD CONSTRAINT "SubtopicProgress_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
