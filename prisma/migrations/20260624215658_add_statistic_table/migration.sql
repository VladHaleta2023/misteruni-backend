-- CreateTable
CREATE TABLE "Statistic" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "remainingDaysToExam" INTEGER NOT NULL,
    "examsCount" INTEGER NOT NULL,
    "averageExamScore" INTEGER NOT NULL,
    "totalCovered" INTEGER NOT NULL,
    "predictedScore" INTEGER NOT NULL,
    "checkedWordsCount" INTEGER NOT NULL,
    "wordsCoveragePercent" INTEGER NOT NULL,
    "audioTasksCount" INTEGER NOT NULL,
    "averageAudioScore" INTEGER NOT NULL,
    "writingTasksCount" INTEGER NOT NULL,
    "averageWritingScore" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Statistic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Statistic_userId_subjectId_date_idx" ON "Statistic"("userId", "subjectId", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Statistic_userId_subjectId_date_key" ON "Statistic"("userId", "subjectId", "date");
