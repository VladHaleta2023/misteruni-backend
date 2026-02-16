-- CreateTable
CREATE TABLE "UserSection" (
    "id" SERIAL NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "sectionId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "percent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTopic" (
    "id" SERIAL NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "sectionId" INTEGER NOT NULL,
    "topicId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "percent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSubtopic" (
    "id" SERIAL NOT NULL,
    "subjectId" INTEGER NOT NULL,
    "sectionId" INTEGER NOT NULL,
    "topicId" INTEGER NOT NULL,
    "subtopicId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "percent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSubtopic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserSection_userId_subjectId_idx" ON "UserSection"("userId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSection_userId_subjectId_sectionId_key" ON "UserSection"("userId", "subjectId", "sectionId");

-- CreateIndex
CREATE INDEX "UserTopic_userId_subjectId_sectionId_idx" ON "UserTopic"("userId", "subjectId", "sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserTopic_userId_subjectId_topicId_key" ON "UserTopic"("userId", "subjectId", "topicId");

-- CreateIndex
CREATE INDEX "UserSubtopic_userId_subjectId_topicId_idx" ON "UserSubtopic"("userId", "subjectId", "topicId");

-- CreateIndex
CREATE INDEX "UserSubtopic_userId_subjectId_sectionId_idx" ON "UserSubtopic"("userId", "subjectId", "sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSubtopic_userId_subjectId_subtopicId_key" ON "UserSubtopic"("userId", "subjectId", "subtopicId");

-- AddForeignKey
ALTER TABLE "UserSection" ADD CONSTRAINT "UserSection_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSection" ADD CONSTRAINT "UserSection_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSection" ADD CONSTRAINT "UserSection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTopic" ADD CONSTRAINT "UserTopic_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTopic" ADD CONSTRAINT "UserTopic_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTopic" ADD CONSTRAINT "UserTopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTopic" ADD CONSTRAINT "UserTopic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSubtopic" ADD CONSTRAINT "UserSubtopic_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSubtopic" ADD CONSTRAINT "UserSubtopic_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSubtopic" ADD CONSTRAINT "UserSubtopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSubtopic" ADD CONSTRAINT "UserSubtopic_subtopicId_fkey" FOREIGN KEY ("subtopicId") REFERENCES "Subtopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSubtopic" ADD CONSTRAINT "UserSubtopic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
