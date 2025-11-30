import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TopicUpdateRequest } from './dto/topic-request.dto';
import { TimezoneService } from '../timezone/timezone.service';

type Status = 'blocked' | 'started' | 'progress' | 'completed';

@Injectable()
export class TopicService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly timezoneService: TimezoneService
  ) {}

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
        where: {
          id: sectionId
        },
      });

      if (!section) {
        throw new BadRequestException('Dział nie został znaleziony');
      }

      const resolvedTopicExpansionPrompt =
        section.topicExpansionPrompt?.trim() === '' || !section.topicExpansionPrompt
          ? subject.topicExpansionPrompt ?? null
          : section.topicExpansionPrompt;

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

      const resolvedStoriesPrompt =
        section.vocabluaryPrompt?.trim() === '' || !section.vocabluaryPrompt
          ? subject.vocabluaryPrompt ?? null
          : section.vocabluaryPrompt;

      if (withSection) {
        response.section = {
          ...section,
          topicExpansionPrompt: resolvedTopicExpansionPrompt,
          subtopicsPrompt: resolvedSubtopicsPrompt,
          questionPrompt: resolvedQuestionPrompt,
          solutionPrompt: resolvedSolutionPrompt,
          answersPrompt: resolvedAnswersPrompt,
          closedSubtopicsPrompt: resolvedClosedSubtopicsPrompt,
          subQuestionsPrompt: resolvedSubQuestionsPrompt,
          vocabluaryPrompt: resolvedStoriesPrompt,
          subtopicsPromptOwn: Boolean(section.subtopicsPrompt && section.subtopicsPrompt.trim() !== ""),
          questionPromptOwn: Boolean(section.questionPrompt && section.questionPrompt.trim() !== ""),
          solutionPromptOwn: Boolean(section.solutionPrompt && section.solutionPrompt.trim() !== ""),
          answersPromptOwn: Boolean(section.answersPrompt && section.answersPrompt.trim() !== ""),
          closedSubtopicsPromptOwn: Boolean(section.closedSubtopicsPrompt && section.closedSubtopicsPrompt.trim() !== ""),
          subQuestionsPromptOwn: Boolean(section.subQuestionsPrompt && section.subQuestionsPrompt.trim() !== ""),
          vocabluaryPromptOwn: Boolean(section.vocabluaryPrompt && section.vocabluaryPrompt.trim() !== ""),
          topicExpansionPromptOwn: Boolean(section.topicExpansionPrompt && section.topicExpansionPrompt.trim() !== ""),
        };
      }

      const topics = await this.prismaService.topic.findMany({
        where: { sectionId: sectionId },
        orderBy: { partId: 'asc' },
      });

      const resolvedTopics = topics.map((topic) => {
        return {
          ...topic,
          topicExpansionPrompt:
            topic.topicExpansionPrompt?.trim() === '' || !topic.topicExpansionPrompt
              ? resolvedTopicExpansionPrompt
              : topic.topicExpansionPrompt,
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
              ? resolvedStoriesPrompt
              : topic.vocabluaryPrompt,
          subtopicsPromptOwn: Boolean(topic.subtopicsPrompt && topic.subtopicsPrompt.trim() !== ""),
          questionPromptOwn: Boolean(topic.questionPrompt && topic.questionPrompt.trim() !== ""),
          solutionPromptOwn: Boolean(topic.solutionPrompt && topic.solutionPrompt.trim() !== ""),
          answersPromptOwn: Boolean(topic.answersPrompt && topic.answersPrompt.trim() !== ""),
          closedSubtopicsPromptOwn: Boolean(topic.closedSubtopicsPrompt && topic.closedSubtopicsPrompt.trim() !== ""),
          subQuestionsPromptOwn: Boolean(topic.subQuestionsPrompt && topic.subQuestionsPrompt.trim() !== ""),
          vocabluaryPromptOwn: Boolean(topic.vocabluaryPrompt && topic.vocabluaryPrompt.trim() !== ""),
          topicExpansionPromptOwn: Boolean(topic.topicExpansionPrompt && topic.topicExpansionPrompt.trim() !== ""),
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
            where: {
                id: sectionId,
            },
        });

        if (!section) {
            throw new BadRequestException('Dział nie został znaleziony');
        }

        const resolvedTopicExpansionPrompt =
            section.topicExpansionPrompt?.trim() === '' || !section.topicExpansionPrompt
                ? subject.topicExpansionPrompt ?? null
                : section.topicExpansionPrompt;

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

        const resolvedStoriesPrompt =
            section.vocabluaryPrompt?.trim() === '' || !section.vocabluaryPrompt
                ? subject.vocabluaryPrompt ?? null
                : section.vocabluaryPrompt;

        if (withSection) {
            response.section = {
                ...section,
                topicExpansionPrompt: resolvedTopicExpansionPrompt,
                subtopicsPrompt: resolvedSubtopicsPrompt,
                questionPrompt: resolvedQuestionPrompt,
                solutionPrompt: resolvedSolutionPrompt,
                answersPrompt: resolvedAnswersPrompt,
                closedSubtopicsPrompt: resolvedClosedSubtopicsPrompt,
                subQuestionsPrompt: resolvedSubQuestionsPrompt,
                vocabluaryPrompt: resolvedStoriesPrompt,
                subtopicsPromptOwn: Boolean(section.subtopicsPrompt && section.subtopicsPrompt.trim() !== ""),
                questionPromptOwn: Boolean(section.questionPrompt && section.questionPrompt.trim() !== ""),
                solutionPromptOwn: Boolean(section.solutionPrompt && section.solutionPrompt.trim() !== ""),
                answersPromptOwn: Boolean(section.answersPrompt && section.answersPrompt.trim() !== ""),
                closedSubtopicsPromptOwn: Boolean(section.closedSubtopicsPrompt && section.closedSubtopicsPrompt.trim() !== ""),
                subQuestionsPromptOwn: Boolean(section.subQuestionsPrompt && section.subQuestionsPrompt.trim() !== ""),
                vocabluaryPromptOwn: Boolean(section.vocabluaryPrompt && section.vocabluaryPrompt.trim() !== ""),
                topicExpansionPromptOwn: Boolean(section.topicExpansionPrompt && section.topicExpansionPrompt.trim() !== "")
            };
        }

        const topic = await this.prismaService.topic.findFirst({
            where: { id, sectionId },
        });

        if (!topic) {
            throw new BadRequestException('Temat nie został znaleziony');
        }

        const subtopics = await this.prismaService.subtopic.findMany({
            where: { topicId: id },
            include: {
                progresses: {
                    where: {
                        task: { finished: true }
                    },
                    select: {
                        percent: true,
                        updatedAt: true,
                    },
                    orderBy: { updatedAt: 'asc' }
                }
            }
        });

        const subtopicsWithStatus = subtopics.map(subtopic => {
            const progresses = subtopic.progresses;
            
            let percent = 0;
            const alpha = 0.7;
            
            if (progresses.length > 0) {
                let emaValue: number | null = null;
                for (const progress of progresses) {
                    // КОНВЕРТИРУЕМ UTC ИЗ БАЗЫ В ЛОКАЛЬНОЕ ВРЕМЯ ДЛЯ РАСЧЕТОВ
                    const localUpdatedAt = this.timezoneService.utcToLocal(progress.updatedAt);
                    
                    const currentPercent = Math.min(100, progress.percent);
                    if (emaValue === null) {
                        emaValue = currentPercent;
                    } else {
                        emaValue = (emaValue * (1 - alpha)) + (currentPercent * alpha);
                    }
                }
                percent = Math.min(100, Math.ceil(emaValue!));
            }
            
            let subtopicStatus: Status;
            if (percent === 0) {
                subtopicStatus = 'started';
            } else if (percent < subject.threshold) {
                subtopicStatus = 'progress';
            } else {
                subtopicStatus = 'completed';
            }
            
            return {
                ...subtopic,
                percent,
                status: subtopicStatus
            };
        });

        const averagePercent = subtopicsWithStatus.length > 0
          ? Math.ceil(subtopicsWithStatus.reduce((sum, st) => sum + st.percent, 0) / subtopicsWithStatus.length)
          : 0;

        const completed = averagePercent >= subject.threshold;
        response.topic = {
            ...topic,
            completed: completed,
            topicExpansionPrompt:
               topic.topicExpansionPrompt?.trim() === '' || !topic.topicExpansionPrompt
                  ? resolvedTopicExpansionPrompt
                  : topic.topicExpansionPrompt,
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
                    ? resolvedStoriesPrompt
                    : topic.vocabluaryPrompt,
            subtopicsPromptOwn: Boolean(topic.subtopicsPrompt && topic.subtopicsPrompt.trim() !== ""),
            questionPromptOwn: Boolean(topic.questionPrompt && topic.questionPrompt.trim() !== ""),
            solutionPromptOwn: Boolean(topic.solutionPrompt && topic.solutionPrompt.trim() !== ""),
            answersPromptOwn: Boolean(topic.answersPrompt && topic.answersPrompt.trim() !== ""),
            closedSubtopicsPromptOwn: Boolean(topic.closedSubtopicsPrompt && topic.closedSubtopicsPrompt.trim() !== ""),
            subQuestionsPromptOwn: Boolean(topic.subQuestionsPrompt && topic.subQuestionsPrompt.trim() !== ""),
            vocabluaryPromptOwn: Boolean(topic.vocabluaryPrompt && topic.vocabluaryPrompt.trim() !== ""),
            topicExpansionPromptOwn: Boolean(topic.topicExpansionPrompt && topic.topicExpansionPrompt.trim() !== "")
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

  async findWords(
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

      const words = await this.prismaService.word.findMany({
        where: {
          task: {
            topicId: id
          }
        },
        include: {
          task: {
            select: {
              id: true,
              text: true,
              topicId: true
            }
          }
        },
        orderBy: [
          { totalCorrectCount: 'asc' },
          { streakCorrectCount: 'asc' },
          { totalAttemptCount: 'asc' },
          { id: 'asc' }
        ]
      });

      return {
        statusCode: 200,
        message: 'Słowa zostały pobrane pomyślnie',
        words: words,
      };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Nie udało się pobrać słowy tematu');
    }
  }
}