/*
  Warnings:

  - You are about to drop the column `answersPrompt` on the `Section` table. All the data in the column will be lost.
  - You are about to drop the column `chatPrompt` on the `Section` table. All the data in the column will be lost.
  - You are about to drop the column `chronologyPrompt` on the `Section` table. All the data in the column will be lost.
  - You are about to drop the column `closedSubtopicsPrompt` on the `Section` table. All the data in the column will be lost.
  - You are about to drop the column `literaturePrompt` on the `Section` table. All the data in the column will be lost.
  - You are about to drop the column `questionPrompt` on the `Section` table. All the data in the column will be lost.
  - You are about to drop the column `solutionGuidePrompt` on the `Section` table. All the data in the column will be lost.
  - You are about to drop the column `subtopicsPrompt` on the `Section` table. All the data in the column will be lost.
  - You are about to drop the column `subtopicsStatusPrompt` on the `Section` table. All the data in the column will be lost.
  - You are about to drop the column `topicExpansionPrompt` on the `Section` table. All the data in the column will be lost.
  - You are about to drop the column `topicFrequencyPrompt` on the `Section` table. All the data in the column will be lost.
  - You are about to drop the column `vocabluaryPrompt` on the `Section` table. All the data in the column will be lost.
  - You are about to drop the column `vocabularyGuidePrompt` on the `Section` table. All the data in the column will be lost.
  - You are about to drop the column `wordsPrompt` on the `Section` table. All the data in the column will be lost.
  - You are about to drop the column `answersPrompt` on the `Topic` table. All the data in the column will be lost.
  - You are about to drop the column `chatPrompt` on the `Topic` table. All the data in the column will be lost.
  - You are about to drop the column `chronologyPrompt` on the `Topic` table. All the data in the column will be lost.
  - You are about to drop the column `closedSubtopicsPrompt` on the `Topic` table. All the data in the column will be lost.
  - You are about to drop the column `literaturePrompt` on the `Topic` table. All the data in the column will be lost.
  - You are about to drop the column `questionPrompt` on the `Topic` table. All the data in the column will be lost.
  - You are about to drop the column `solutionGuidePrompt` on the `Topic` table. All the data in the column will be lost.
  - You are about to drop the column `subtopicsPrompt` on the `Topic` table. All the data in the column will be lost.
  - You are about to drop the column `subtopicsStatusPrompt` on the `Topic` table. All the data in the column will be lost.
  - You are about to drop the column `topicExpansionPrompt` on the `Topic` table. All the data in the column will be lost.
  - You are about to drop the column `topicFrequencyPrompt` on the `Topic` table. All the data in the column will be lost.
  - You are about to drop the column `vocabluaryPrompt` on the `Topic` table. All the data in the column will be lost.
  - You are about to drop the column `vocabularyGuidePrompt` on the `Topic` table. All the data in the column will be lost.
  - You are about to drop the column `wordsPrompt` on the `Topic` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Section" DROP COLUMN "answersPrompt",
DROP COLUMN "chatPrompt",
DROP COLUMN "chronologyPrompt",
DROP COLUMN "closedSubtopicsPrompt",
DROP COLUMN "literaturePrompt",
DROP COLUMN "questionPrompt",
DROP COLUMN "solutionGuidePrompt",
DROP COLUMN "subtopicsPrompt",
DROP COLUMN "subtopicsStatusPrompt",
DROP COLUMN "topicExpansionPrompt",
DROP COLUMN "topicFrequencyPrompt",
DROP COLUMN "vocabluaryPrompt",
DROP COLUMN "vocabularyGuidePrompt",
DROP COLUMN "wordsPrompt";

-- AlterTable
ALTER TABLE "Topic" DROP COLUMN "answersPrompt",
DROP COLUMN "chatPrompt",
DROP COLUMN "chronologyPrompt",
DROP COLUMN "closedSubtopicsPrompt",
DROP COLUMN "literaturePrompt",
DROP COLUMN "questionPrompt",
DROP COLUMN "solutionGuidePrompt",
DROP COLUMN "subtopicsPrompt",
DROP COLUMN "subtopicsStatusPrompt",
DROP COLUMN "topicExpansionPrompt",
DROP COLUMN "topicFrequencyPrompt",
DROP COLUMN "vocabluaryPrompt",
DROP COLUMN "vocabularyGuidePrompt",
DROP COLUMN "wordsPrompt";
