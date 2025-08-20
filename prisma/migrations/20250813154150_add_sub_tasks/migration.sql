/*
  Warnings:

  - You are about to drop the column `percent` on the `Task` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Task" DROP COLUMN "percent",
ADD COLUMN     "parentTaskId" INTEGER;

-- AddForeignKey
ALTER TABLE "public"."Task" ADD CONSTRAINT "Task_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "public"."Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
