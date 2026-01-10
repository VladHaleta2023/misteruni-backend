/*
  Warnings:

  - You are about to drop the `_TaskWords` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_TaskWords" DROP CONSTRAINT "_TaskWords_A_fkey";

-- DropForeignKey
ALTER TABLE "_TaskWords" DROP CONSTRAINT "_TaskWords_B_fkey";

-- DropTable
DROP TABLE "_TaskWords";

-- CreateTable
CREATE TABLE "TaskWord" (
    "taskId" INTEGER NOT NULL,
    "wordId" INTEGER NOT NULL,

    CONSTRAINT "TaskWord_pkey" PRIMARY KEY ("taskId","wordId")
);

-- AddForeignKey
ALTER TABLE "TaskWord" ADD CONSTRAINT "TaskWord_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskWord" ADD CONSTRAINT "TaskWord_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word"("id") ON DELETE CASCADE ON UPDATE CASCADE;
