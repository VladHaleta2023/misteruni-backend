import { BadRequestException, HttpException, HttpStatus, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TopicUpdateRequest, WordsAIGenerate } from './dto/topic-request.dto';
import { TimezoneService } from '../timezone/timezone.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Prisma } from '@prisma/client';

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

  private getPrompt = (...prompts: (string | null | undefined)[]): string | null => {
    for (const prompt of prompts) {
        if (prompt && prompt.trim() !== '') {
            return prompt;
        }
    }
    return null;
  };

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

      const resolvedTopicFrequencyPrompt =
        section.topicFrequencyPrompt?.trim() === '' || !section.topicFrequencyPrompt
          ? subject.topicFrequencyPrompt ?? null
          : section.topicFrequencyPrompt;

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
          topicFrequencyPrompt: resolvedTopicFrequencyPrompt,
          topicExpansionPrompt: resolvedTopicExpansionPrompt,
          subtopicsPrompt: resolvedSubtopicsPrompt,
          subtopicsStatusPrompt: resolvedSubtopicsStatusPrompt,
          questionPrompt: resolvedQuestionPrompt,
          solutionPrompt: resolvedSolutionPrompt,
          answersPrompt: resolvedAnswersPrompt,
          closedSubtopicsPrompt: resolvedClosedSubtopicsPrompt,
          vocabluaryPrompt: resolvedStoriesPrompt,
          wordsPrompt: resolvedWordsPrompt,
          subtopicsPromptOwn: Boolean(section.subtopicsPrompt && section.subtopicsPrompt.trim() !== ""),
          subtopicsStatusPromptOwn: Boolean(section.subtopicsStatusPrompt && section.subtopicsStatusPrompt.trim() !== ""),
          questionPromptOwn: Boolean(section.questionPrompt && section.questionPrompt.trim() !== ""),
          solutionPromptOwn: Boolean(section.solutionPrompt && section.solutionPrompt.trim() !== ""),
          answersPromptOwn: Boolean(section.answersPrompt && section.answersPrompt.trim() !== ""),
          closedSubtopicsPromptOwn: Boolean(section.closedSubtopicsPrompt && section.closedSubtopicsPrompt.trim() !== ""),
          vocabluaryPromptOwn: Boolean(section.vocabluaryPrompt && section.vocabluaryPrompt.trim() !== ""),
          wordsPromptOwn: Boolean(section.wordsPrompt && section.wordsPrompt.trim() !== ""),
          topicExpansionPromptOwn: Boolean(section.topicExpansionPrompt && section.topicExpansionPrompt.trim() !== ""),
          topicFrequencyPromptOwn: Boolean(section.topicFrequencyPrompt && section.topicFrequencyPrompt.trim() !== ""),
        };
      }

      const topics = await this.prismaService.topic.findMany({
        where: { sectionId: sectionId },
        orderBy: { partId: 'asc' },
        include: {
          subtopics: {
            orderBy: { partId: 'asc' }
          }
        }
      });

      const resolvedTopics = topics.map((topic) => {
        return {
          ...topic,
          topicFrequencyPrompt: this.getPrompt(
            topic.topicFrequencyPrompt,
            section.topicFrequencyPrompt,
            subject.topicFrequencyPrompt
          ) ?? "",
          topicExpansionPrompt: this.getPrompt(
            topic.topicExpansionPrompt,
            section.topicExpansionPrompt,
            subject.topicExpansionPrompt
          ) ?? "",
          questionPrompt: this.getPrompt(
            topic.questionPrompt,
            section.questionPrompt,
            subject.questionPrompt
          ) ?? "",
          solutionPrompt: this.getPrompt(
            topic.solutionPrompt,
            section.solutionPrompt,
            subject.solutionPrompt
          ) ?? "",
          answersPrompt: this.getPrompt(
            topic.answersPrompt,
            section.answersPrompt,
            subject.answersPrompt
          ) ?? "",
          closedSubtopicsPrompt: this.getPrompt(
            topic.closedSubtopicsPrompt,
            section.closedSubtopicsPrompt,
            subject.closedSubtopicsPrompt
          ) ?? "",
          subtopicsPrompt: this.getPrompt(
            topic.subtopicsPrompt,
            section.subtopicsPrompt,
            subject.subtopicsPrompt
          ) ?? "",
          subtopicsStatusPrompt: this.getPrompt(
            topic.subtopicsStatusPrompt,
            section.subtopicsStatusPrompt,
            subject.subtopicsStatusPrompt
          ) ?? "",
          vocabluaryPrompt: this.getPrompt(
            topic.vocabluaryPrompt,
            section.vocabluaryPrompt,
            subject.vocabluaryPrompt
          ) ?? "",
          wordsPrompt: this.getPrompt(
            topic.wordsPrompt,
            section.wordsPrompt,
            subject.wordsPrompt
          ) ?? "",
          subtopicsPromptOwn: Boolean(topic.subtopicsPrompt && topic.subtopicsPrompt.trim() !== ""),
          subtopicsStatusPromptOwn: Boolean(topic.subtopicsStatusPrompt && topic.subtopicsStatusPrompt.trim() !== ""),
          questionPromptOwn: Boolean(topic.questionPrompt && topic.questionPrompt.trim() !== ""),
          solutionPromptOwn: Boolean(topic.solutionPrompt && topic.solutionPrompt.trim() !== ""),
          answersPromptOwn: Boolean(topic.answersPrompt && topic.answersPrompt.trim() !== ""),
          closedSubtopicsPromptOwn: Boolean(topic.closedSubtopicsPrompt && topic.closedSubtopicsPrompt.trim() !== ""),
          vocabluaryPromptOwn: Boolean(topic.vocabluaryPrompt && topic.vocabluaryPrompt.trim() !== ""),
          wordsPromptOwn: Boolean(topic.wordsPrompt && topic.wordsPrompt.trim() !== ""),
          topicExpansionPromptOwn: Boolean(topic.topicExpansionPrompt && topic.topicExpansionPrompt.trim() !== ""),
          topicFrequencyPromptOwn: Boolean(topic.topicFrequencyPrompt && topic.topicFrequencyPrompt.trim() !== ""),
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

        const resolvedTopicFrequencyPrompt =
            section.topicFrequencyPrompt?.trim() === '' || !section.topicFrequencyPrompt
                ? subject.topicFrequencyPrompt ?? null
                : section.topicFrequencyPrompt;

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

        const resolvedStoriesPrompt =
            section.vocabluaryPrompt?.trim() === '' || !section.vocabluaryPrompt
                ? subject.vocabluaryPrompt ?? null
                : section.vocabluaryPrompt;

        const resolvedWordsPrompt =
            section.wordsPrompt?.trim() === '' || !section.wordsPrompt
                ? subject.wordsPrompt ?? null
                : section.wordsPrompt;

        const resolvedChatPrompt =
            section.chatPrompt?.trim() === '' || !section.chatPrompt
                ? subject.chatPrompt ?? null
                : section.chatPrompt;

        if (withSection) {
            response.section = {
                ...section,
                topicFrequencyPrompt: resolvedTopicFrequencyPrompt,
                topicExpansionPrompt: resolvedTopicExpansionPrompt,
                subtopicsPrompt: resolvedSubtopicsPrompt,
                subtopicsStatusPrompt: resolvedSubtopicsStatusPrompt,
                questionPrompt: resolvedQuestionPrompt,
                solutionPrompt: resolvedSolutionPrompt,
                answersPrompt: resolvedAnswersPrompt,
                closedSubtopicsPrompt: resolvedClosedSubtopicsPrompt,
                vocabluaryPrompt: resolvedStoriesPrompt,
                wordsPrompt: resolvedWordsPrompt,
                chatPrompt: resolvedChatPrompt,
                subtopicsPromptOwn: Boolean(section.subtopicsPrompt && section.subtopicsPrompt.trim() !== ""),
                subtopicsStatusPromptOwn: Boolean(section.subtopicsStatusPrompt && section.subtopicsStatusPrompt.trim() !== ""),
                questionPromptOwn: Boolean(section.questionPrompt && section.questionPrompt.trim() !== ""),
                solutionPromptOwn: Boolean(section.solutionPrompt && section.solutionPrompt.trim() !== ""),
                answersPromptOwn: Boolean(section.answersPrompt && section.answersPrompt.trim() !== ""),
                closedSubtopicsPromptOwn: Boolean(section.closedSubtopicsPrompt && section.closedSubtopicsPrompt.trim() !== ""),
                vocabluaryPromptOwn: Boolean(section.vocabluaryPrompt && section.vocabluaryPrompt.trim() !== ""),
                wordsPromptOwn: Boolean(section.wordsPrompt && section.wordsPrompt.trim() !== ""),
                chatPromptOwn: Boolean(section.chatPrompt && section.chatPrompt.trim() !== ""),
                topicExpansionPromptOwn: Boolean(section.topicExpansionPrompt && section.topicExpansionPrompt.trim() !== ""),
                topicFrequencyPromptOwn: Boolean(section.topicFrequencyPrompt && section.topicFrequencyPrompt.trim() !== "")
            };
        }

        const topic = await this.prismaService.topic.findFirst({
            where: { id, sectionId },
            include: {
              subtopics: {
                orderBy: {
                  partId: 'asc'
                }
              }
            }
        });

        if (!topic) {
            throw new BadRequestException('Temat nie został znaleziony');
        }

        response.topic = {
            ...topic,
            topicFrequencyPrompt: this.getPrompt(
              topic.topicFrequencyPrompt,
              section.topicFrequencyPrompt,
              subject.topicFrequencyPrompt
            ) ?? "",
            topicExpansionPrompt: this.getPrompt(
              topic.topicExpansionPrompt,
              section.topicExpansionPrompt,
              subject.topicExpansionPrompt
            ) ?? "",
            questionPrompt: this.getPrompt(
              topic.questionPrompt,
              section.questionPrompt,
              subject.questionPrompt
            ) ?? "",
            solutionPrompt: this.getPrompt(
              topic.solutionPrompt,
              section.solutionPrompt,
              subject.solutionPrompt
            ) ?? "",
            answersPrompt: this.getPrompt(
              topic.answersPrompt,
              section.answersPrompt,
              subject.answersPrompt
            ) ?? "",
            closedSubtopicsPrompt: this.getPrompt(
              topic.closedSubtopicsPrompt,
              section.closedSubtopicsPrompt,
              subject.closedSubtopicsPrompt
            ) ?? "",
            subtopicsPrompt: this.getPrompt(
              topic.subtopicsPrompt,
              section.subtopicsPrompt,
              subject.subtopicsPrompt
            ) ?? "",
            subtopicsStatusPrompt: this.getPrompt(
              topic.subtopicsStatusPrompt,
              section.subtopicsStatusPrompt,
              subject.subtopicsStatusPrompt
            ) ?? "",
            vocabluaryPrompt: this.getPrompt(
              topic.vocabluaryPrompt,
              section.vocabluaryPrompt,
              subject.vocabluaryPrompt
            ) ?? "",
            wordsPrompt: this.getPrompt(
              topic.wordsPrompt,
              section.wordsPrompt,
              subject.wordsPrompt
            ) ?? "",
            subtopicsPromptOwn: Boolean(topic.subtopicsPrompt && topic.subtopicsPrompt.trim() !== ""),
            subtopicsStatusPromptOwn: Boolean(topic.subtopicsStatusPrompt && topic.subtopicsStatusPrompt.trim() !== ""),
            questionPromptOwn: Boolean(topic.questionPrompt && topic.questionPrompt.trim() !== ""),
            solutionPromptOwn: Boolean(topic.solutionPrompt && topic.solutionPrompt.trim() !== ""),
            answersPromptOwn: Boolean(topic.answersPrompt && topic.answersPrompt.trim() !== ""),
            closedSubtopicsPromptOwn: Boolean(topic.closedSubtopicsPrompt && topic.closedSubtopicsPrompt.trim() !== ""),
            vocabluaryPromptOwn: Boolean(topic.vocabluaryPrompt && topic.vocabluaryPrompt.trim() !== ""),
            wordsPromptOwn: Boolean(topic.wordsPrompt && topic.wordsPrompt.trim() !== ""),
            chatPromptOwn: Boolean(topic.chatPrompt && topic.chatPrompt.trim() !== ""),
            topicExpansionPromptOwn: Boolean(topic.topicExpansionPrompt && topic.topicExpansionPrompt.trim() !== ""),
            topicFrequencyPromptOwn: Boolean(topic.topicFrequencyPrompt && topic.topicFrequencyPrompt.trim() !== ""),
        };

        return response;
    }
    catch (error) {
        throw new InternalServerErrorException('Nie udało się pobrać tematu');
    }
  }

  async findTopicCompletedById(
    userId: number,
    subjectId: number,
    sectionId: number,
    topicId: number,
  ) {
    try {
      const result = await this.prismaService.$queryRaw<{
        completed: boolean;
      }[]>`
        SELECT EXISTS(
          SELECT 1 
          FROM "Topic" t
          LEFT JOIN "UserSubject" us ON 
            us."userId" = ${userId} 
            AND us."subjectId" = t."subjectId"  -- Используем subjectId из Topic
          LEFT JOIN "UserTopic" ut ON 
            ut."userId" = ${userId} 
            AND ut."topicId" = t.id
          WHERE t.id = ${topicId} 
            AND t."sectionId" = ${sectionId}
            AND t."subjectId" = ${subjectId}
            AND COALESCE(ut."percent", 0) >= COALESCE(us."threshold", 50)
        ) as completed
      `;

      const completed = result[0]?.completed ?? false;

      return {
        statusCode: 200,
        message: 'Pobrano temat pomyślnie',
        completed: completed
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Nie udało się pobrać tematu');
    }
  }

  async updateTopicTransaction(
      subjectId: number,
      sectionId: number,
      id: number,
      data: TopicUpdateRequest
  ) {
      try {
          const existingSubject = await this.prismaService.subject.findUnique({ 
              where: { id: subjectId } 
          });

          if (!existingSubject) {
            return {
                statusCode: 404,
                message: `Przedmiot nie został znaleziony`,
            };
          }

          const existingSection = await this.prismaService.section.findUnique({ 
              where: { id: sectionId } 
          });

          if (!existingSection) {
              return {
                  statusCode: 404,
                  message: `Dział nie został znaleziony`,
              };
          }

          const existingTopic = await this.prismaService.topic.findUnique({ 
              where: { id } 
          });

          if (!existingTopic) {
              return {
                  statusCode: 404,
                  message: `Temat nie został znaleziony`,
              };
          }

          const result = await this.prismaService.$transaction(async (prisma) => {
              const updateData: any = {};
              
              if (data.name !== undefined) updateData.name = data.name;
              if (data.literature !== undefined) updateData.literature = data.literature;
              if (data.frequency !== undefined) updateData.frequency = data.frequency;
              if (data.note !== undefined) updateData.note = data.note;

              const updatedTopic = await prisma.topic.update({
                  where: { id },
                  data: updateData
              });

              if (data.outputSubtopics && data.outputSubtopics.length > 0) {
                  const updatePromises = data.outputSubtopics.map(([subtopicName, partId]) => 
                      prisma.subtopic.updateMany({
                          where: {
                              name: subtopicName,
                              topicId: id,
                              subjectId: subjectId,
                              sectionId: sectionId
                          },
                          data: {
                              partId: partId
                          }
                      })
                  );
                  
                  await Promise.all(updatePromises);
              }

              return updatedTopic;
          }, {
            timeout: 900000
          });

          return {
              statusCode: 200,
              message: 'Temat został pomyślnie zaktualizowany',
              topic: result,
          };
      } catch (error) {
          console.error('Error updating topic:', error);
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
              switch (error.code) {
                  case 'P2028':
                      throw new InternalServerErrorException(
                          'Błąd transakcji: utracono połączenie z bazą danych. Spróbuj ponownie.'
                      );
                  case 'P2034':
                      throw new InternalServerErrorException(
                          'Błąd transakcji: konflikt dostępu do danych. Spróbuj ponownie.'
                      );
                  case 'P2025':
                      throw new NotFoundException('Podtemat nie został znaleziony');
              }
          }
          
          throw new InternalServerErrorException(
              `Błąd podczas aktualizacji tematu: ${error.message || 'Nieznany błąd'}`
          );
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
      data.difficulty = data.difficulty ?? section.difficulty;

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
          !r?.difficulty ||
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