/*
  Warnings:

  - You are about to drop the column `threshold` on the `Subject` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `UserSubject` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SubjectDetailLevel" AS ENUM ('MANDATORY', 'DESIRABLE', 'OPTIONAL');

-- AlterTable
ALTER TABLE "Subject" DROP COLUMN "threshold";

-- AlterTable
ALTER TABLE "UserSubject" ADD COLUMN     "detailLevel" "SubjectDetailLevel" NOT NULL DEFAULT 'MANDATORY',
ADD COLUMN     "threshold" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "UserSubject_detailLevel_idx" ON "UserSubject"("detailLevel");
