/*
  Warnings:

  - You are about to alter the column `percent` on the `Task` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.

*/
-- AlterTable
ALTER TABLE "Task" ALTER COLUMN "percent" SET DEFAULT 0,
ALTER COLUMN "percent" SET DATA TYPE INTEGER;
