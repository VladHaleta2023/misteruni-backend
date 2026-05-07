import { BadRequestException, HttpException, HttpStatus, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TopicUpdateRequest, WordsAIGenerate } from './dto/topic-request.dto';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Prisma } from '@prisma/client';

@Injectable()
export class TopicService {
  private readonly fastapiUrl: string | undefined;

  constructor(
    private readonly prismaService: PrismaService,
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
  ) {
    try {
      const subject = await this.prismaService.subject.findUnique({
        where: { id: subjectId },
      });

      if (!subject) {
        throw new BadRequestException('Przedmiot nie został znaleziony');
      }

      const section = await this.prismaService.section.findUnique({
        where: {
          id: sectionId
        },
      });

      if (!section) {
        throw new BadRequestException('Dział nie został znaleziony');
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

      const updatedTopics = topics.map((topic) => ({
        ...topic,
        type:
          topic.type && topic.type.trim() !== ''
            ? topic.type
            : section.type,
      }));

      return {
        subject,
        section,
        topics: updatedTopics,
        statusCode: 200,
        message: 'Pobrano listę tematów pomyślnie',
      };
    }
    catch (error) {
      throw new InternalServerErrorException('Nie udało się pobrać tematów');
    }
  }

  async findTopicbyId(
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
          where: {
            id: sectionId,
          },
        });

        if (!section) {
            throw new BadRequestException('Dział nie został znaleziony');
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

        const finalType =
          topic.type && topic.type.trim() !== ''
            ? topic.type
            : section.type;

        return {
          topic: {
            ...topic,
            type: finalType,
          },
          section,
          subject,
          statusCode: 200,
          message: 'Pobrano temat pomyślnie',
        };
    }
    catch (error) {
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
              if (data.type !== undefined) updateData.type = data.type;
              if (data.difficulty !== undefined) updateData.difficulty = data.difficulty;
              if (data.information !== undefined) updateData.information = data.information;

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
      data.type = data.type ?? topic.type;
      data.difficulty = data.difficulty ?? section.difficulty;
      data.information = data.information ?? topic.information;

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

      const taskWords = await this.prismaService.taskWord.findMany({
        where: {
          word: {
            topicId,
            subjectId,
          },
        },
        select: {
          taskId: true,
        },
      });

      const taskIds = [...new Set(taskWords.map((tw) => tw.taskId))];

      const deletedWords = await this.prismaService.word.deleteMany({
        where: {
          topicId,
          subjectId,
        },
      });

      let deletedTasksCount = 0;

      if (taskIds.length > 0) {
        const tasksWithoutWords = await this.prismaService.task.findMany({
          where: {
            id: { in: taskIds },
            words: {
              none: {},
            },
          },
          select: { id: true },
        });

        const idsToDelete = tasksWithoutWords.map((t) => t.id);

        if (idsToDelete.length > 0) {
          const deletedTasks = await this.prismaService.task.deleteMany({
            where: {
              id: { in: idsToDelete },
            },
          });

          deletedTasksCount = deletedTasks.count;
        }
      }

      return {
        statusCode: 200,
        message: `Słowy tematyczne zostały pomyślnie usunięte. Usunięto: ${deletedWords.count} słów`,
        deletedCount: deletedWords.count
      };
    } catch (error) {
      console.error('Błąd podczas usuwania słów tematycznych:', error);
      throw new InternalServerErrorException('Błąd podczas usuwania słów tematycznych');
    }
  }
}