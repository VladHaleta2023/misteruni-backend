import { BadRequestException, HttpException, HttpStatus, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Section, Topic, Word } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import { VocabluaryAIGenerate } from '../task/dto/task-generate.dto';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

type Status = 'started' | 'progress' | 'completed';

@Injectable()
export class WordService {
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

    async adminFetchWords(
        userId: number,
        subjectId: number,
        topicId: number | null | undefined,
        taskId: number | null | undefined
    ) {
        try {
            const subject = await this.prismaService.subject.findUnique({
                where: { id: subjectId },
            });

            if (!subject) throw new BadRequestException('Przedmiot nie został znaleziony');

            let topic: any = null;
            if (topicId != null) {
                topic = await this.prismaService.topic.findUnique({
                    where: { id: topicId }
                });
            }

            const userSubject = await this.prismaService.userSubject.findUnique({
                where: { userId_subjectId: { userId, subjectId } },
                select: { threshold: true, detailLevel: true }
            });

            const threshold = userSubject?.threshold ?? 50;

            const whereCondition: any = {
                userId,
                subjectId,
                topicId: topicId ?? null,
                ...(taskId != null
                    ? { tasks: { some: { taskId, userId } } }
                    : {})
            };

            const words = await this.prismaService.word.findMany({
                where: whereCondition,
                include: {
                    tasks: {
                        include: {
                            task: {
                                select: {
                                    id: true,
                                    text: true,
                                    topic: {
                                        select: { id: true, sectionId: true, subjectId: true }
                                    },
                                }
                            }
                        }
                    }
                }
            });

            const formattedWords = words.map(word => {
                const percent = word.totalAttemptCount > 0
                    ? Math.min(100, Math.ceil(word.totalCorrectCount / word.totalAttemptCount * 100))
                    : 0;

                let status: Status;
                if (percent === 0) status = 'started';
                else if (percent < threshold) status = 'progress';
                else status = 'completed';

                return {
                    ...word,
                    percent,
                    status,
                    tasks: word.tasks.map(tw => tw.task),
                };
            });

            const totalPercent = formattedWords.reduce((sum, w) => sum + w.percent, 0);
            const averagePercentByWords = formattedWords.length > 0
                ? Math.ceil(totalPercent / formattedWords.length)
                : 0;

            let wordsStatus: Status;
            if (averagePercentByWords === 0) wordsStatus = 'started';
            else if (averagePercentByWords < threshold) wordsStatus = 'progress';
            else wordsStatus = 'completed';

            const sortedWords = formattedWords.sort((a, b) => {
                const getPriority = (percent: number) => {
                    if (percent === 0) return 1;
                    if (percent < threshold) return 0;
                    return 2;
                };

                const aPriority = getPriority(a.percent);
                const bPriority = getPriority(b.percent);

                if (aPriority !== bPriority) return aPriority - bPriority;
                if (a.frequency !== b.frequency) return b.frequency - a.frequency;
                if (a.totalCorrectCount !== b.totalCorrectCount)
                    return b.totalCorrectCount - a.totalCorrectCount;

                return a.text.localeCompare(b.text);
            });

            return {
                statusCode: 200,
                message: 'Słowa zostały pobrane pomyślnie',
                words: sortedWords,
                topic,
                wordsStatus,
                wordsPercent: averagePercentByWords
            };

        } catch (error) {
            throw new InternalServerErrorException('Nie udało się pobrać słów tematu');
        }
    }

    async fetchWords(
        userId: number,
        subjectId: number,
        topicId: number | null | undefined,
        taskId: number | null | undefined,
        wordIds?: number[]
    ) {
        try {
            const subject = await this.prismaService.subject.findUnique({
                where: { id: subjectId },
            });

            if (!subject) throw new BadRequestException('Przedmiot nie został znaleziony');

            let topic: any = null;
            if (topicId != null) {
                topic = await this.prismaService.topic.findUnique({
                    where: { id: topicId }
                });
            }

            const userSubject = await this.prismaService.userSubject.findUnique({
                where: { userId_subjectId: { userId, subjectId } },
                select: { threshold: true, detailLevel: true }
            });

            const threshold = userSubject?.threshold ?? 50;

            const whereCondition: any = {
                userId,
                subjectId,
                topicId: topicId ?? null,
                ...(taskId != null
                    ? { tasks: { some: { taskId, userId } } }
                    : {}),
                ...(Array.isArray(wordIds) && wordIds.length > 0
                    ? { id: { in: wordIds } }
                    : {}),
            };

            const words = await this.prismaService.word.findMany({
                where: whereCondition,
                include: {
                    tasks: {
                        include: {
                            task: {
                                select: {
                                    id: true,
                                    text: true,
                                    topic: {
                                        select: { id: true, sectionId: true, subjectId: true }
                                    },
                                }
                            }
                        }
                    }
                }
            });

            const formattedWords = words.map(word => {
                const percent = word.totalAttemptCount > 0
                    ? Math.min(100, Math.ceil(word.totalCorrectCount / word.totalAttemptCount * 100))
                    : 0;

                let status: Status;
                if (percent === 0) status = 'started';
                else if (percent < threshold) status = 'progress';
                else status = 'completed';

                return {
                    ...word,
                    percent,
                    status,
                    tasks: word.tasks.map(tw => tw.task),
                };
            });

            const totalPercent = formattedWords.reduce((sum, w) => sum + w.percent, 0);
            const averagePercentByWords = formattedWords.length > 0
                ? Math.ceil(totalPercent / formattedWords.length)
                : 0;

            let wordsStatus: Status;
            if (averagePercentByWords === 0) wordsStatus = 'started';
            else if (averagePercentByWords < threshold) wordsStatus = 'progress';
            else wordsStatus = 'completed';

            const sortedWords = formattedWords.sort((a, b) => {
                const getPriority = (percent: number) => {
                    if (percent === 0) return 1;
                    if (percent < threshold) return 0;
                    return 2;
                };

                const aPriority = getPriority(a.percent);
                const bPriority = getPriority(b.percent);

                if (aPriority !== bPriority) return aPriority - bPriority;
                if (a.frequency !== b.frequency) return b.frequency - a.frequency;
                if (a.totalCorrectCount !== b.totalCorrectCount)
                    return b.totalCorrectCount - a.totalCorrectCount;

                return a.text.localeCompare(b.text);
            });

            return {
                statusCode: 200,
                message: 'Słowa zostały pobrane pomyślnie',
                words: sortedWords,
                topic,
                wordsStatus,
                wordsPercent: averagePercentByWords
            };

        } catch (error) {
            throw new InternalServerErrorException('Nie udało się pobrać słów tematu');
        }
    }

    async findWords(
        userId: number,
        subjectId: number,
        wordIds: number[]
    ) {
        try {
            const subject = await this.prismaService.subject.findUnique({
                where: { id: subjectId },
            });
            
            if (!subject) {
                throw new BadRequestException('Przedmiot nie został znaleziony');
            }

            let words: Word[] = [];

            if (Array.isArray(wordIds) && wordIds.length > 0) {
                words = await this.prismaService.word.findMany({
                    where: {
                        userId,
                        subjectId,
                        id: { in: wordIds },
                    },
                });
            }

            return {
                statusCode: 200,
                message: 'Pobranie słów lub wyrazów udane',
                words
            };
        } catch (error) {
            throw new InternalServerErrorException('Nie udało się pobrać słów lub wyrazów');
        }
    }

    async deleteWord(
        userId: number,
        subjectId: number,
        id: number,
    ) {
        try {
            const subject = await this.prismaService.subject.findUnique({
                where: { id: subjectId },
            });
            
            if (!subject) {
                throw new BadRequestException('Przedmiot nie został znaleziony');
            }

            const word = await this.prismaService.word.findFirst({
                where: { 
                    id,
                    userId,
                    subjectId
                }
            });

            if (!word) {
                throw new BadRequestException('Słowo nie znalezione w tym przedmiocie');
            }

            await this.prismaService.word.delete({
                where: { id }
            });

            return {
                statusCode: 200,
                message: 'Usuwanie słowa lub wyrazu udane'
            };
        } catch (error) {
            throw new InternalServerErrorException('Nie udało się usunąć słowa lub wyrazu');
        }
    }

    async updateWords(
        userId: number,
        subjectId: number,
        outputWords: string[] = [],
        wordIds?: number[]
    ) {
        try {
            if (!Array.isArray(wordIds) || wordIds.length === 0)
                throw new BadRequestException('Brak listy ID słów');

            const words = await this.prismaService.word.findMany({
                where: { userId, id: { in: wordIds }, subjectId },
            });

            if (words.length === 0)
                throw new BadRequestException('Nie znaleziono słów dla podanych ID');

            const validWordIds = words.map(w => w.id);
            const invalidWordIds = wordIds.filter(id => !validWordIds.includes(id));
            if (invalidWordIds.length > 0)
                throw new BadRequestException(`Niektóre słowa nie należą do tego przedmiotu: ${invalidWordIds.join(', ')}`);

            const normalizedOutputWords = outputWords
                .filter(w => typeof w === 'string')
                .map(w => w.trim().toLowerCase());

            await this.prismaService.$transaction(
                words.map(word => {
                    const isCorrect = !normalizedOutputWords.includes(word.text.trim().toLowerCase());

                    return this.prismaService.word.update({
                        where: { id: word.id, userId },
                        data: {
                            finished: isCorrect,
                            totalAttemptCount: { increment: 1 },
                            totalCorrectCount: isCorrect ? { increment: 1 } : undefined,
                        }
                    });
                })
            );

            const updatedWords = await this.prismaService.word.findMany({
                where: { userId, id: { in: validWordIds }, subjectId },
                orderBy: [{ finished: 'desc' }],
            });

            return {
                statusCode: 200,
                message: 'Wyrazy zostały zaktualizowane pomyślnie',
                words: updatedWords,
            };

        } catch (error) {
            throw new InternalServerErrorException('Nie udało się zaktualizować wyrazów');
        }
    }

    async vocabluaryAIGenerate(
        subjectId: number,
        data: VocabluaryAIGenerate,
        sectionId?: number | null,
        topicId?: number | null,
        signal?: AbortSignal
    ) {
        const url = `${this.fastapiUrl}/admin/vocabluary-generate`;
        
        try {
            const subject = await this.prismaService.subject.findUnique({
                where: { id: subjectId },
            });

            if (!subject) {
                throw new BadRequestException('Przedmiot nie został znaleziony');
            }

            let section: Section | null = null;
            let topic: Topic | null = null;

            if (sectionId) {
                section = await this.prismaService.section.findUnique({
                    where: { id: sectionId },
                });
            }

            if (topicId) {
                topic = await this.prismaService.topic.findUnique({
                    where: { id: topicId },
                });
            }

            const resolvedVocabliaryPrompt =
                topic?.vocabluaryPrompt?.trim()
                    ? topic.vocabluaryPrompt
                    : section?.vocabluaryPrompt?.trim()
                    ? section.vocabluaryPrompt
                    : subject.vocabluaryPrompt ?? null;

            data.prompt = resolvedVocabliaryPrompt;

            if (!Array.isArray(data.words) || !data.words.every(item =>
                Array.isArray(item) &&
                item.length === 2 &&
                typeof item[0] === 'string' &&
                typeof item[1] === 'string'
            )) {
                throw new BadRequestException('Words musi być listą par [string, string]');
            }

            if (!Array.isArray(data.errors) || !data.errors.every(item => typeof item === 'string')) {
                throw new BadRequestException('Errors musi być listą stringów');
            }

            const response$ = this.httpService.post(url, data, { signal });
            const response = await firstValueFrom(response$);
            const r = response.data;

            if (
                typeof r.prompt !== 'string' ||
                typeof r.changed !== 'string' ||
                typeof r.outputText !== 'string' ||
                !Array.isArray(r.words) ||
                !Array.isArray(r.errors) ||
                !Array.isArray(r.outputWords) ||
                typeof r.attempt !== 'number'
            ) {
                throw new BadRequestException('Niepoprawna struktura odpowiedzi z serwera.');
            }

            if (!r.words.every((item: any) =>
                Array.isArray(item) &&
                item.length === 2 &&
                typeof item[0] === 'string' &&
                typeof item[1] === 'string'
            )) {
                throw new BadRequestException('Words musi być listą par [string, string]');
            }

            if (!r.errors.every((item: any) => typeof item === 'string')) {
                throw new BadRequestException('Errors musi być listą stringów');
            }

            if (!r.outputWords.every((item: any) => typeof item === 'string')) {
                throw new BadRequestException('OutputSubtopics musi być listą stringów');
            }

            return {
                statusCode: 201,
                message: "Weryfikacja słów lub wyrazów zadania udane",
                ...r
            };
        }
        catch (error) {
            if (error.response && error.response.data) {
                const fastApiErrorMessage = error.response.data.detail || JSON.stringify(error.response.data);
                throw new HttpException(`Błąd API: ${fastApiErrorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
            }
            throw new InternalServerErrorException(`Błąd serwisu generującego: ${error.message || error.toString()}`);
        }
    }
}
