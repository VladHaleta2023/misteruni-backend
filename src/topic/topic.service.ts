import { BadRequestException, HttpException, HttpStatus, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TopicUpdateRequest, Word, WordsAIGenerate } from './dto/topic-request.dto';
import { TimezoneService } from '../timezone/timezone.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

type Status = 'started' | 'progress' | 'completed';

@Injectable()
export class TopicService {
  private readonly fastapiUrl: string | undefined;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly timezoneService: TimezoneService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const node_env = this.configService.get<string>('APP_ENV') || 'development';

    if (node_env === 'development') {
      this.fastapiUrl = this.configService.get<string>('FASTAPI_URL_LOCAL') || undefined;
    }
    else {
      this.fastapiUrl = this.configService.get<string>('FASTAPI_URL') || undefined;
    }
  }

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

      const resolvedSubtopicsStatusPrompt =
        section.subtopicsStatusPrompt?.trim() === '' || !section.subtopicsStatusPrompt
          ? subject.subtopicsStatusPrompt ?? null
          : section.subtopicsStatusPrompt;

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

      const resolvedWordsPrompt =
        section.wordsPrompt?.trim() === '' || !section.wordsPrompt
          ? subject.wordsPrompt ?? null
          : section.wordsPrompt;

      if (withSection) {
        response.section = {
          ...section,
          topicExpansionPrompt: resolvedTopicExpansionPrompt,
          subtopicsPrompt: resolvedSubtopicsPrompt,
          subtopicsStatusPrompt: resolvedSubtopicsStatusPrompt,
          questionPrompt: resolvedQuestionPrompt,
          solutionPrompt: resolvedSolutionPrompt,
          answersPrompt: resolvedAnswersPrompt,
          closedSubtopicsPrompt: resolvedClosedSubtopicsPrompt,
          subQuestionsPrompt: resolvedSubQuestionsPrompt,
          vocabluaryPrompt: resolvedStoriesPrompt,
          wordsPrompt: resolvedWordsPrompt,
          subtopicsPromptOwn: Boolean(section.subtopicsPrompt && section.subtopicsPrompt.trim() !== ""),
          subtopicsStatusPromptOwn: Boolean(section.subtopicsStatusPrompt && section.subtopicsStatusPrompt.trim() !== ""),
          questionPromptOwn: Boolean(section.questionPrompt && section.questionPrompt.trim() !== ""),
          solutionPromptOwn: Boolean(section.solutionPrompt && section.solutionPrompt.trim() !== ""),
          answersPromptOwn: Boolean(section.answersPrompt && section.answersPrompt.trim() !== ""),
          closedSubtopicsPromptOwn: Boolean(section.closedSubtopicsPrompt && section.closedSubtopicsPrompt.trim() !== ""),
          subQuestionsPromptOwn: Boolean(section.subQuestionsPrompt && section.subQuestionsPrompt.trim() !== ""),
          vocabluaryPromptOwn: Boolean(section.vocabluaryPrompt && section.vocabluaryPrompt.trim() !== ""),
          wordsPromptOwn: Boolean(section.wordsPrompt && section.wordsPrompt.trim() !== ""),
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
          subtopicsStatusPrompt:
            topic.subtopicsStatusPrompt?.trim() === '' || !topic.subtopicsStatusPrompt
              ? resolvedSubtopicsStatusPrompt
              : topic.subtopicsStatusPrompt,
          subQuestionsPrompt:
            topic.subQuestionsPrompt?.trim() === '' || !topic.subQuestionsPrompt
              ? resolvedSubQuestionsPrompt
              : topic.subQuestionsPrompt,
          vocabluaryPrompt:
            topic.vocabluaryPrompt?.trim() === '' || !topic.vocabluaryPrompt
              ? resolvedStoriesPrompt
              : topic.vocabluaryPrompt,
          wordsPrompt:
            topic.wordsPrompt?.trim() === '' || !topic.wordsPrompt
              ? resolvedWordsPrompt
              : topic.wordsPrompt,
          subtopicsPromptOwn: Boolean(topic.subtopicsPrompt && topic.subtopicsPrompt.trim() !== ""),
          subtopicsStatusPromptOwn: Boolean(topic.subtopicsStatusPrompt && topic.subtopicsStatusPrompt.trim() !== ""),
          questionPromptOwn: Boolean(topic.questionPrompt && topic.questionPrompt.trim() !== ""),
          solutionPromptOwn: Boolean(topic.solutionPrompt && topic.solutionPrompt.trim() !== ""),
          answersPromptOwn: Boolean(topic.answersPrompt && topic.answersPrompt.trim() !== ""),
          closedSubtopicsPromptOwn: Boolean(topic.closedSubtopicsPrompt && topic.closedSubtopicsPrompt.trim() !== ""),
          subQuestionsPromptOwn: Boolean(topic.subQuestionsPrompt && topic.subQuestionsPrompt.trim() !== ""),
          vocabluaryPromptOwn: Boolean(topic.vocabluaryPrompt && topic.vocabluaryPrompt.trim() !== ""),
          wordsPromptOwn: Boolean(topic.wordsPrompt && topic.wordsPrompt.trim() !== ""),
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
    userId: number,
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

        const userSubject = await this.prismaService.userSubject.findUnique({
            where: {
                userId_subjectId: {
                    userId: userId,
                    subjectId: subjectId
                }
            },
            select: {
                threshold: true,
                detailLevel: true
            }
        });

        const threshold = userSubject?.threshold ?? 50;

        const resolvedTopicExpansionPrompt =
            section.topicExpansionPrompt?.trim() === '' || !section.topicExpansionPrompt
                ? subject.topicExpansionPrompt ?? null
                : section.topicExpansionPrompt;

        const resolvedSubtopicsPrompt =
            section.subtopicsPrompt?.trim() === '' || !section.subtopicsPrompt
                ? subject.subtopicsPrompt ?? null
                : section.subtopicsPrompt;

        const resolvedSubtopicsStatusPrompt =
            section.subtopicsStatusPrompt?.trim() === '' || !section.subtopicsStatusPrompt
                ? subject.subtopicsStatusPrompt ?? null
                : section.subtopicsStatusPrompt;

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

        const resolvedWordsPrompt =
            section.wordsPrompt?.trim() === '' || !section.wordsPrompt
                ? subject.wordsPrompt ?? null
                : section.wordsPrompt;

        if (withSection) {
            response.section = {
                ...section,
                topicExpansionPrompt: resolvedTopicExpansionPrompt,
                subtopicsPrompt: resolvedSubtopicsPrompt,
                subtopicsStatusPrompt: resolvedSubtopicsStatusPrompt,
                questionPrompt: resolvedQuestionPrompt,
                solutionPrompt: resolvedSolutionPrompt,
                answersPrompt: resolvedAnswersPrompt,
                closedSubtopicsPrompt: resolvedClosedSubtopicsPrompt,
                subQuestionsPrompt: resolvedSubQuestionsPrompt,
                vocabluaryPrompt: resolvedStoriesPrompt,
                wordsPrompt: resolvedWordsPrompt,
                subtopicsPromptOwn: Boolean(section.subtopicsPrompt && section.subtopicsPrompt.trim() !== ""),
                subtopicsStatusPromptOwn: Boolean(section.subtopicsStatusPrompt && section.subtopicsStatusPrompt.trim() !== ""),
                questionPromptOwn: Boolean(section.questionPrompt && section.questionPrompt.trim() !== ""),
                solutionPromptOwn: Boolean(section.solutionPrompt && section.solutionPrompt.trim() !== ""),
                answersPromptOwn: Boolean(section.answersPrompt && section.answersPrompt.trim() !== ""),
                closedSubtopicsPromptOwn: Boolean(section.closedSubtopicsPrompt && section.closedSubtopicsPrompt.trim() !== ""),
                subQuestionsPromptOwn: Boolean(section.subQuestionsPrompt && section.subQuestionsPrompt.trim() !== ""),
                vocabluaryPromptOwn: Boolean(section.vocabluaryPrompt && section.vocabluaryPrompt.trim() !== ""),
                wordsPromptOwn: Boolean(section.wordsPrompt && section.wordsPrompt.trim() !== ""),
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
                      userId, task: { userId, finished: true }
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
            } else if (percent < threshold) {
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

        const completed = averagePercent >= threshold;
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
            subtopicsStatusPrompt:
                topic.subtopicsStatusPrompt?.trim() === '' || !topic.subtopicsStatusPrompt
                    ? resolvedSubtopicsStatusPrompt
                    : topic.subtopicsStatusPrompt,
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
            wordsPrompt:
                topic.wordsPrompt?.trim() === '' || !topic.wordsPrompt
                    ? resolvedWordsPrompt
                    : topic.wordsPrompt,
            subtopicsPromptOwn: Boolean(topic.subtopicsPrompt && topic.subtopicsPrompt.trim() !== ""),
            subtopicsStatusPromptOwn: Boolean(topic.subtopicsStatusPrompt && topic.subtopicsStatusPrompt.trim() !== ""),
            questionPromptOwn: Boolean(topic.questionPrompt && topic.questionPrompt.trim() !== ""),
            solutionPromptOwn: Boolean(topic.solutionPrompt && topic.solutionPrompt.trim() !== ""),
            answersPromptOwn: Boolean(topic.answersPrompt && topic.answersPrompt.trim() !== ""),
            closedSubtopicsPromptOwn: Boolean(topic.closedSubtopicsPrompt && topic.closedSubtopicsPrompt.trim() !== ""),
            subQuestionsPromptOwn: Boolean(topic.subQuestionsPrompt && topic.subQuestionsPrompt.trim() !== ""),
            vocabluaryPromptOwn: Boolean(topic.vocabluaryPrompt && topic.vocabluaryPrompt.trim() !== ""),
            wordsPromptOwn: Boolean(topic.wordsPrompt && topic.wordsPrompt.trim() !== ""),
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
        throw new InternalServerErrorException('Błąd podczas aktualizacji temat');
    }
  }

  async wordsAIGenerate(
    subjectId: number,
    sectionId: number,
    topicId: number,
    data: WordsAIGenerate,
    signal?: AbortSignal
  ) {
    const url = `${this.fastapiUrl}/admin/words-generate`;

    try {
      const subject = await this.prismaService.subject.findUnique({ where: { id: subjectId } });
      if (!subject) throw new BadRequestException('Przedmiot nie został znaleziony');

      const section = await this.prismaService.section.findUnique({ where: { id: sectionId } });
      if (!section) throw new BadRequestException('Dział nie został znaleziony');

      const topic = await this.prismaService.topic.findUnique({ where: { id: topicId } });
      if (!topic) throw new BadRequestException('Temat nie został znaleziony');

      data.subject = data.subject ?? subject.name;
      data.section = data.section ?? section.name;
      data.topic = data.topic ?? topic.name;

      if (!Array.isArray(data.words) || !data.words.every(item =>
          Array.isArray(item) &&
          item.length === 2 &&
          typeof item[0] === 'string' &&
          typeof item[1] === 'number'
      )) {
        throw new BadRequestException('Words musi być listą par [string, number]');
      }

      if (!Array.isArray(data.errors) || !data.errors.every(item => typeof item === 'string')) {
        throw new BadRequestException('Errors musi być listą stringów');
      }

      const response$ = this.httpService.post(url, data, { signal });
      const response = await firstValueFrom(response$);
      const r = response.data;

      if (
          !r?.prompt ||
          !r?.changed ||
          !r?.subject ||
          !r?.section ||
          !r?.topic ||
          !Array.isArray(r.words) ||
          !Array.isArray(r.errors) ||
          typeof r.attempt !== 'number'
      ) {
        throw new BadRequestException('Niepoprawna struktura odpowiedzi z serwera.');
      }

      if (!r.words.every((item: any) =>
          Array.isArray(item) &&
          item.length === 2 &&
          typeof item[0] === 'string' &&
          typeof item[1] === 'number'
      )) {
        throw new BadRequestException('Words musi być listą par [string, number]');
      }

      if (!r.errors.every((item: any) => typeof item === 'string')) {
        throw new BadRequestException('Errors musi być listą stringów');
      }

      return {
        statusCode: 201,
        message: "Generacja słów kluczowych udana",
        ...r
      };
    } catch (error) {
      if (error.response && error.response.data) {
        const fastApiErrorMessage = error.response.data.detail || JSON.stringify(error.response.data);
        throw new HttpException(`Błąd API: ${fastApiErrorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      throw new InternalServerErrorException(`Błąd serwisu generującego: ${error.message || error.toString()}`);
    }
  }

  async createWordsByTopicId(
    userId: number,
    subjectId: number,
    sectionId: number,
    topicId: number,
    words: [string, number][],
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

      const existingTopic = await this.prismaService.topic.findUnique({ where: { id: topicId } });
      if (!existingTopic) {
        return {
          statusCode: 404,
          message: `Temat nie został znaleziony`,
        };
      }

      const wordsToCreate = words.map(word => ({
        userId,
        subjectId,
        text: word[0].toLowerCase().trim(),
        frequency: word[1],
        topicId: topicId,
        finished: false,
        streakCorrectCount: 0,
        totalAttemptCount: 0,
        totalCorrectCount: 0,
      }));

      let createdCount = 0;
      let skippedCount = 0;

      for (const wordData of wordsToCreate) {
        try {
          await this.prismaService.word.create({
            data: wordData,
          });
          createdCount++;
        } catch (error) {
          if (error.code === 'P2002') {
            skippedCount++;
            continue;
          }
          throw error;
        }
      }

      return {
        statusCode: 200,
        message: `Słowy tematyczne zostały pomyślnie dodane. Dodano: ${createdCount}, pominięto istniejących: ${skippedCount}`,
        stats: {
          created: createdCount,
          skipped: skippedCount,
          total: words.length
        }
      };
    } catch (error) {
      console.error('Błąd podczas dodawania słów tematycznych:', error);
      throw new InternalServerErrorException('Błąd podczas dodawania słów tematycznych');
    }
  }

  async deleteWordsByTopicId(
    userId: number,
    subjectId: number,
    sectionId: number,
    topicId: number
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

      const existingTopic = await this.prismaService.topic.findUnique({ where: { id: topicId } });
      if (!existingTopic) {
        return {
          statusCode: 404,
          message: `Temat nie został znaleziony`,
        };
      }

      const deleted = await this.prismaService.word.deleteMany({
        where: { 
          userId,
          topicId,
          subjectId,
        }
      });

      return {
        statusCode: 200,
        message: `Słowy tematyczne zostały pomyślnie usunięte. Usunięto: ${deleted.count} słów`,
        deletedCount: deleted.count
      };
    } catch (error) {
      console.error('Błąd podczas usuwania słów tematycznych:', error);
      throw new InternalServerErrorException('Błąd podczas usuwania słów tematycznych');
    }
  }
}