import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TopicUpdateRequest } from './dto/topic-request.dto';

@Injectable()
export class TopicService {
  constructor(private readonly prismaService: PrismaService) {}

  async findAllTopics(
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

      if (withSection) {
        response.section = {
          ...section,
          subtopicsPrompt: resolvedSubtopicsPrompt,
          questionPrompt: resolvedQuestionPrompt,
          solutionPrompt: resolvedSolutionPrompt,
          answersPrompt: resolvedAnswersPrompt,
        };
      }

      const topics = await this.prismaService.topic.findMany({
        where: { sectionId: sectionId },
        orderBy: { partId: 'asc' },
      });

      const resolvedTopics = topics.map((topic) => {
        return {
          ...topic,
          subtopicsPrompt: resolvedSubtopicsPrompt,
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

      if (withSection) {
        response.section = {
          ...section,
          subtopicsPrompt: resolvedSubtopicsPrompt,
          questionPrompt: resolvedQuestionPrompt,
          solutionPrompt: resolvedSolutionPrompt,
          answersPrompt: resolvedAnswersPrompt,
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
        subtopicsPrompt: resolvedSubtopicsPrompt,
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

      const updatedTopic = await this.prismaService.topic.update({
          where: { id },
          data,
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
}