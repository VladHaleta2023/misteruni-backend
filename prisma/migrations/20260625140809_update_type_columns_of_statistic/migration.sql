/*
  Warnings:

  - You are about to alter the column `averageExamScore` on the `Statistic` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `totalCovered` on the `Statistic` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `predictedScore` on the `Statistic` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `averageAudioScore` on the `Statistic` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - You are about to alter the column `averageWritingScore` on the `Statistic` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.

*/
-- AlterTable
ALTER TABLE "Statistic" ALTER COLUMN "averageExamScore" SET DATA TYPE INTEGER,
ALTER COLUMN "totalCovered" SET DATA TYPE INTEGER,
ALTER COLUMN "predictedScore" SET DATA TYPE INTEGER,
ALTER COLUMN "averageAudioScore" SET DATA TYPE INTEGER,
ALTER COLUMN "averageWritingScore" SET DATA TYPE INTEGER;
