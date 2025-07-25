import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

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
        !section.subtopicsPrompt || section.subtopicsPrompt.trim() === ''
          ? subject.subtopicsPrompt ?? null
          : section.subtopicsPrompt;

      const resolvedSubtopicsCriterions =
        !section.subtopicsCriterions || section.subtopicsCriterions.trim() === ''
          ? subject.subtopicsCriterions ?? null
          : section.subtopicsCriterions;

      const resolvedSubtopicsRefinePrompt =
        !section.subtopicsRefinePrompt || section.subtopicsRefinePrompt.trim() === ''
          ? subject.subtopicsRefinePrompt ?? null
          : section.subtopicsRefinePrompt;

      if (withSection) {
        response.section = {
          ...section,
          subtopicsPrompt: resolvedSubtopicsPrompt,
          subtopicsRefinePrompt: resolvedSubtopicsRefinePrompt,
          subtopicsCriterion: resolvedSubtopicsCriterions,
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
          subtopicsRefinePrompt: resolvedSubtopicsRefinePrompt,
          subtopicsCriterion: resolvedSubtopicsCriterions,
        };
      });

      response.topics = resolvedTopics;

      return response;
    }
    catch (error) {
      console.error('Nie udało się pobrać tematów:', error);
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
        !section.subtopicsPrompt || section.subtopicsPrompt.trim() === ''
          ? subject.subtopicsPrompt ?? null
          : section.subtopicsPrompt;

      const resolvedSubtopicsCriterions =
        !section.subtopicsCriterions || section.subtopicsCriterions.trim() === ''
          ? subject.subtopicsCriterions ?? null
          : section.subtopicsCriterions;

      const resolvedSubtopicsRefinePrompt =
        !section.subtopicsRefinePrompt || section.subtopicsRefinePrompt.trim() === ''
          ? subject.subtopicsRefinePrompt ?? null
          : section.subtopicsRefinePrompt;

      if (withSection) {
        response.section = {
          ...section,
          subtopicsPrompt: resolvedSubtopicsPrompt,
          subtopicsRefinePrompt: resolvedSubtopicsRefinePrompt,
          subtopicsCriterion: resolvedSubtopicsCriterions,
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
        subtopicsRefinePrompt: resolvedSubtopicsRefinePrompt,
        subtopicsCriterion: resolvedSubtopicsCriterions,
      };

      return response;
    }
    catch (error) {
      console.error('Nie udało się pobrać tematu:', error);
      throw new InternalServerErrorException('Nie udało się pobrać tematu');
    }
  }
}