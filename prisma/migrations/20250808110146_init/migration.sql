-- CreateTable
CREATE TABLE "public"."Subject" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "prompt" TEXT NOT NULL DEFAULT '',
    "difficulty" INTEGER NOT NULL DEFAULT 0,
    "threshold" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "url" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT '',
    "subtopicsPrompt" TEXT NOT NULL DEFAULT '',
    "questionPrompt" TEXT NOT NULL DEFAULT '',
    "solutionPrompt" TEXT NOT NULL DEFAULT '',
    "answersPrompt" TEXT NOT NULL DEFAULT '',
    "closedProblemsPrompt" TEXT NOT NULL DEFAULT '',
    "newProblemsPrompt" TEXT NOT NULL DEFAULT '',
    "closedSubtopicsPrompt" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Section" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "subjectId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "partId" INTEGER NOT NULL DEFAULT -1,
    "type" TEXT NOT NULL DEFAULT '',
    "subtopicsPrompt" TEXT NOT NULL DEFAULT '',
    "questionPrompt" TEXT NOT NULL DEFAULT '',
    "solutionPrompt" TEXT NOT NULL DEFAULT '',
    "answersPrompt" TEXT NOT NULL DEFAULT '',
    "closedProblemsPrompt" TEXT NOT NULL DEFAULT '',
    "newProblemsPrompt" TEXT NOT NULL DEFAULT '',
    "closedSubtopicsPrompt" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Topic" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "sectionId" INTEGER NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "partId" INTEGER NOT NULL DEFAULT -1,
    "questionPrompt" TEXT NOT NULL DEFAULT '',
    "solutionPrompt" TEXT NOT NULL DEFAULT '',
    "answersPrompt" TEXT NOT NULL DEFAULT '',
    "closedProblemsPrompt" TEXT NOT NULL DEFAULT '',
    "newProblemsPrompt" TEXT NOT NULL DEFAULT '',
    "closedSubtopicsPrompt" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Subtopic" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "sectionId" INTEGER NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "topicId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "percent" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Subtopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Task" (
    "id" SERIAL NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "correctOptionIndex" INTEGER NOT NULL DEFAULT 0,
    "solution" TEXT NOT NULL DEFAULT '',
    "userSolution" TEXT NOT NULL DEFAULT '',
    "userOptionIndex" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "percent" INTEGER NOT NULL DEFAULT 0,
    "finished" BOOLEAN NOT NULL DEFAULT false,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "closedProblems" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "newProblems" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "topicId" INTEGER NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Problem" (
    "id" SERIAL NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "topicId" INTEGER NOT NULL,

    CONSTRAINT "Problem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subject_name_key" ON "public"."Subject"("name");

-- AddForeignKey
ALTER TABLE "public"."Section" ADD CONSTRAINT "Section_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "public"."Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Topic" ADD CONSTRAINT "Topic_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "public"."Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Topic" ADD CONSTRAINT "Topic_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "public"."Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Subtopic" ADD CONSTRAINT "Subtopic_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "public"."Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Subtopic" ADD CONSTRAINT "Subtopic_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "public"."Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Subtopic" ADD CONSTRAINT "Subtopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "public"."Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Task" ADD CONSTRAINT "Task_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "public"."Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Problem" ADD CONSTRAINT "Problem_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "public"."Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
