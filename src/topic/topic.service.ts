import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TopicUpdateRequest } from './dto/topic-request.dto';

@Injectable()
export class TopicService {
  constructor(private readonly prismaService: PrismaService) {}

  async findTopics(
    subjectId: number,
    sectionId: number,
    withSubject = true,
    withSection = true,
  ) {
    try {
      const response: any = {
        statusCode: 200,
        message: 'Pobrano listę tematów pomyślnie',
      };

      const subject = await this.prismaService.subject.findUnique({
        where: { id: subjectId },
      });

      if (!subject) {
        throw new BadRequestException('Przedmiot nie został znaleziony');
      }

      if (withSubject) {
        response.subject = subject;
      }

      const section = await this.prismaService.section.findUnique({
        where: { id: sectionId },
      });

      if (!section) {
        throw new BadRequestException('Dział nie został znaleziony');
      }

      const resolvedSubtopicsPrompt =
        section.subtopicsPrompt?.trim() === '' || !section.subtopicsPrompt
          ? subject.subtopicsPrompt ?? null
          : section.subtopicsPrompt;

      const resolvedQuestionPrompt =
        section.questionPrompt?.trim() === '' || !section.questionPrompt
          ? subject.questionPrompt ?? null
          : section.questionPrompt;

      const resolvedSolutionPrompt =
        section.solutionPrompt?.trim() === '' || !section.solutionPrompt
          ? subject.solutionPrompt ?? null
          : section.solutionPrompt;

      const resolvedAnswersPrompt =
        section.answersPrompt?.trim() === '' || !section.answersPrompt
          ? subject.answersPrompt ?? null
          : section.answersPrompt;

      const resolvedClosedSubtopicsPrompt =
        section.closedSubtopicsPrompt?.trim() === '' || !section.closedSubtopicsPrompt
          ? subject.closedSubtopicsPrompt ?? null
          : section.closedSubtopicsPrompt;

      const resolvedSubQuestionsPrompt =
        section.subQuestionsPrompt?.trim() === '' || !section.subQuestionsPrompt
          ? subject.subQuestionsPrompt ?? null
          : section.subQuestionsPrompt;

      const resolvedVocabluaryPrompt =
        section.vocabluaryPrompt?.trim() === '' || !section.vocabluaryPrompt
          ? subject.vocabluaryPrompt ?? null
          : section.vocabluaryPrompt;

      if (withSection) {
        response.section = {
          ...section,
          subtopicsPrompt: resolvedSubtopicsPrompt,
          questionPrompt: resolvedQuestionPrompt,
          solutionPrompt: resolvedSolutionPrompt,
          answersPrompt: resolvedAnswersPrompt,
          closedSubtopicsPrompt: resolvedClosedSubtopicsPrompt,
          subQuestionsPrompt: resolvedSubQuestionsPrompt,
          vocabluaryPrompt: resolvedVocabluaryPrompt,
          subtopicsPromptOwn: Boolean(section.subtopicsPrompt && section.subtopicsPrompt.trim() !== ""),
          questionPromptOwn: Boolean(section.questionPrompt && section.questionPrompt.trim() !== ""),
          solutionPromptOwn: Boolean(section.solutionPrompt && section.solutionPrompt.trim() !== ""),
          answersPromptOwn: Boolean(section.answersPrompt && section.answersPrompt.trim() !== ""),
          closedSubtopicsPromptOwn: Boolean(section.closedSubtopicsPrompt && section.closedSubtopicsPrompt.trim() !== ""),
          subQuestionsPromptOwn: Boolean(section.subQuestionsPrompt && section.subQuestionsPrompt.trim() !== ""),
          vocabluaryPromptOwn: Boolean(section.vocabluaryPrompt && section.vocabluaryPrompt.trim() !== ""),
        };
      }

      const topics = await this.prismaService.topic.findMany({
        where: { sectionId: sectionId },
        orderBy: { partId: 'asc' },
      });

      const resolvedTopics = topics.map((topic) => {
        return {
          ...topic,
          questionPrompt:
            topic.questionPrompt?.trim() === '' || !topic.questionPrompt
              ? resolvedQuestionPrompt
              : topic.questionPrompt,
          solutionPrompt:
            topic.solutionPrompt?.trim() === '' || !topic.solutionPrompt
              ? resolvedSolutionPrompt
              : topic.solutionPrompt,
          answersPrompt:
            topic.answersPrompt?.trim() === '' || !topic.answersPrompt
              ? resolvedAnswersPrompt
              : topic.answersPrompt,
          closedSubtopicsPrompt:
            topic.closedSubtopicsPrompt?.trim() === '' || !topic.closedSubtopicsPrompt
              ? resolvedClosedSubtopicsPrompt
              : topic.closedSubtopicsPrompt,
          subtopicsPrompt:
            topic.subtopicsPrompt?.trim() === '' || !topic.subtopicsPrompt
              ? resolvedSubtopicsPrompt
              : topic.subtopicsPrompt,
          subQuestionsPrompt:
            topic.subQuestionsPrompt?.trim() === '' || !topic.subQuestionsPrompt
              ? resolvedSubQuestionsPrompt
              : topic.subQuestionsPrompt,
          vocabluaryPrompt:
            topic.vocabluaryPrompt?.trim() === '' || !topic.vocabluaryPrompt
              ? resolvedVocabluaryPrompt
              : topic.vocabluaryPrompt,
          subtopicsPromptOwn: Boolean(topic.subtopicsPrompt && topic.subtopicsPrompt.trim() !== ""),
          questionPromptOwn: Boolean(topic.questionPrompt && topic.questionPrompt.trim() !== ""),
          solutionPromptOwn: Boolean(topic.solutionPrompt && topic.solutionPrompt.trim() !== ""),
          answersPromptOwn: Boolean(topic.answersPrompt && topic.answersPrompt.trim() !== ""),
          closedSubtopicsPromptOwn: Boolean(topic.closedSubtopicsPrompt && topic.closedSubtopicsPrompt.trim() !== ""),
          subQuestionsPromptOwn: Boolean(topic.subQuestionsPrompt && topic.subQuestionsPrompt.trim() !== ""),
          vocabluaryPromptOwn: Boolean(topic.vocabluaryPrompt && topic.vocabluaryPrompt.trim() !== "")
        };
      });

      response.topics = resolvedTopics;

      return response;
    }
    catch (error) {
      throw new InternalServerErrorException('Nie udało się pobrać tematów');
    }
  }

  async findTopicbyId(
    subjectId: number,
    sectionId: number,
    id: number,
    withSubject = true,
    withSection = true,
  ) {
    try {
      const response: any = {
        statusCode: 200,
        message: 'Pobrano temat pomyślnie',
      };

      const subject = await this.prismaService.subject.findUnique({
        where: { id: subjectId },
      });

      if (!subject) {
        throw new BadRequestException('Przedmiot nie został znaleziony');
      }

      if (withSubject) {
        response.subject = subject;
      }

      const section = await this.prismaService.section.findUnique({
        where: { id: sectionId },
      });

      if (!section) {
        throw new BadRequestException('Dział nie został znaleziony');
      }

      const resolvedSubtopicsPrompt =
        section.subtopicsPrompt?.trim() === '' || !section.subtopicsPrompt
          ? subject.subtopicsPrompt ?? null
          : section.subtopicsPrompt;

      const resolvedQuestionPrompt =
        section.questionPrompt?.trim() === '' || !section.questionPrompt
          ? subject.questionPrompt ?? null
          : section.questionPrompt;

      const resolvedSolutionPrompt =
        section.solutionPrompt?.trim() === '' || !section.solutionPrompt
          ? subject.solutionPrompt ?? null
          : section.solutionPrompt;

      const resolvedAnswersPrompt =
        section.answersPrompt?.trim() === '' || !section.answersPrompt
          ? subject.answersPrompt ?? null
          : section.answersPrompt;

      const resolvedClosedSubtopicsPrompt =
        section.closedSubtopicsPrompt?.trim() === '' || !section.closedSubtopicsPrompt
          ? subject.closedSubtopicsPrompt ?? null
          : section.closedSubtopicsPrompt;

      const resolvedSubQuestionsPrompt =
        section.subQuestionsPrompt?.trim() === '' || !section.subQuestionsPrompt
          ? subject.subQuestionsPrompt ?? null
          : section.subQuestionsPrompt;

      const resolvedVocabluaryPrompt =
        section.vocabluaryPrompt?.trim() === '' || !section.vocabluaryPrompt
          ? subject.vocabluaryPrompt ?? null
          : section.vocabluaryPrompt;

      if (withSection) {
        response.section = {
          ...section,
          subtopicsPrompt: resolvedSubtopicsPrompt,
          questionPrompt: resolvedQuestionPrompt,
          solutionPrompt: resolvedSolutionPrompt,
          answersPrompt: resolvedAnswersPrompt,
          closedSubtopicsPrompt: resolvedClosedSubtopicsPrompt,
          subQuestionsPrompt: resolvedSubQuestionsPrompt,
          vocabluaryPrompt: resolvedVocabluaryPrompt,
          subtopicsPromptOwn: Boolean(section.subtopicsPrompt && section.subtopicsPrompt.trim() !== ""),
          questionPromptOwn: Boolean(section.questionPrompt && section.questionPrompt.trim() !== ""),
          solutionPromptOwn: Boolean(section.solutionPrompt && section.solutionPrompt.trim() !== ""),
          answersPromptOwn: Boolean(section.answersPrompt && section.answersPrompt.trim() !== ""),
          closedSubtopicsPromptOwn: Boolean(section.closedSubtopicsPrompt && section.closedSubtopicsPrompt.trim() !== ""),
          subQuestionsPromptOwn: Boolean(section.subQuestionsPrompt && section.subQuestionsPrompt.trim() !== ""),
          vocabluaryPromptOwn: Boolean(section.vocabluaryPrompt && section.vocabluaryPrompt.trim() !== "")
        };
      }

      const topic = await this.prismaService.topic.findFirst({
        where: { id, sectionId },
      });

      if (!topic) {
        throw new BadRequestException('Temat nie został znaleziony');
      }

      response.topic = {
        ...topic,
        subtopicsPrompt:
          topic.subtopicsPrompt?.trim() === '' || !topic.subtopicsPrompt
              ? resolvedSubtopicsPrompt
              : topic.subtopicsPrompt,
        questionPrompt:
          topic.questionPrompt?.trim() === '' || !topic.questionPrompt
            ? resolvedQuestionPrompt
            : topic.questionPrompt,
        solutionPrompt:
          topic.solutionPrompt?.trim() === '' || !topic.solutionPrompt
            ? resolvedSolutionPrompt
            : topic.solutionPrompt,
        answersPrompt:
          topic.answersPrompt?.trim() === '' || !topic.answersPrompt
            ? resolvedAnswersPrompt
            : topic.answersPrompt,
        closedSubtopicsPrompt:
          topic.closedSubtopicsPrompt?.trim() === '' || !topic.closedSubtopicsPrompt
            ? resolvedClosedSubtopicsPrompt
            : topic.closedSubtopicsPrompt,
        subQuestionsPrompt:
          topic.subQuestionsPrompt?.trim() === '' || !topic.subQuestionsPrompt
            ? resolvedSubQuestionsPrompt
            : topic.subQuestionsPrompt,
        vocabluaryPrompt:
          topic.vocabluaryPrompt?.trim() === '' || !topic.vocabluaryPrompt
            ? resolvedVocabluaryPrompt
            : topic.vocabluaryPrompt,
        subtopicsPromptOwn: Boolean(topic.subtopicsPrompt && topic.subtopicsPrompt.trim() !== ""),
        questionPromptOwn: Boolean(topic.questionPrompt && topic.questionPrompt.trim() !== ""),
        solutionPromptOwn: Boolean(topic.solutionPrompt && topic.solutionPrompt.trim() !== ""),
        answersPromptOwn: Boolean(topic.answersPrompt && topic.answersPrompt.trim() !== ""),
        closedSubtopicsPromptOwn: Boolean(topic.closedSubtopicsPrompt && topic.closedSubtopicsPrompt.trim() !== ""),
        subQuestionsPromptOwn: Boolean(topic.subQuestionsPrompt && topic.subQuestionsPrompt.trim() !== ""),
        vocabluaryPromptOwn: Boolean(topic.vocabluaryPrompt && topic.vocabluaryPrompt.trim() !== "")
      };

      return response;
    }
    catch (error) {
      throw new InternalServerErrorException('Nie udało się pobrać tematu');
    }
  }

  async updateTopic(
    subjectId: number,
    sectionId: number,
    id: number,
    data: TopicUpdateRequest
  ) {
    try {
      const existingSubject = await this.prismaService.subject.findUnique({ where: { id: subjectId } });
      if (!existingSubject) {
          return {
              statusCode: 404,
              message: `Przedmiot nie został znaleziony`,
          };
      }

      const existingSection = await this.prismaService.section.findUnique({ where: { id: sectionId } });
      if (!existingSection) {
          return {
              statusCode: 404,
              message: `Dział nie został znaleziony`,
          };
      }

      const existingTopic = await this.prismaService.topic.findUnique({ where: { id } });
      if (!existingTopic) {
          return {
              statusCode: 404,
              message: `Temat nie został znaleziony`,
          };
      }

      const filteredData = Object.fromEntries(
        Object.entries(data).filter(([_, value]) => value !== undefined)
      );

      const updatedTopic = await this.prismaService.topic.update({
          where: { id },
          data: filteredData
      });

      return {
          statusCode: 200,
          message: 'Temat został pomyślnie zaktualizowany',
          topic: updatedTopic,
      };
    }
    catch (error) {
        console.error(`Nie udało się zaktualizować dział:`, error);
        throw new InternalServerErrorException('Błąd podczas aktualizacji dział');
    }
  }

  async topicBlocked(
    subjectId: number,
    sectionId: number,
    id: number,
  ) {
    try {
      const subject = await this.prismaService.subject.findUnique({
        where: { id: subjectId },
      });

      if (!subject) {
        throw new BadRequestException('Przedmiot nie został znaleziony');
      }

      const section = await this.prismaService.section.findUnique({
        where: { id: sectionId },
      });

      if (!section) {
        throw new BadRequestException('Dział nie został znaleziony');
      }

      const topic = await this.prismaService.topic.findFirst({
        where: { id, sectionId },
      });

      if (!topic) {
        throw new BadRequestException('Temat nie został znaleziony');
      }

      const newBlockedState = !topic.blocked;

      await this.prismaService.topic.update({
        where: { id, sectionId },
        data: { blocked: newBlockedState },
      });

      await this.prismaService.subtopic.updateMany({
        where: { topicId: id, sectionId },
        data: { blocked: newBlockedState },
      });

      const otherTopics = await this.prismaService.topic.findMany({
        where: { sectionId },
        select: { blocked: true },
      });

      const allTopicsBlocked = otherTopics.every(t => t.blocked);

      await this.prismaService.section.update({
        where: { id: sectionId },
        data: { blocked: allTopicsBlocked },
      });

      return {
        statusCode: 200,
        message: newBlockedState
          ? 'Temat został pomyślnie zablokowany'
          : 'Temat został pomyślnie odblokowany',
      };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Nie udało się zaktualizować tematu');
    }
  }
}