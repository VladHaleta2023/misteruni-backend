-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "explanations" TEXT[] DEFAULT ARRAY[]::TEXT[];
