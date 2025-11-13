import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubtopicCreateRequest, SubtopicUpdateRequest } from '../subtopic/dto/subtopic-request.dto';
import { SubtopicsAIGenerate, TopicExpansionAIGenerate } from './dto/subtopics-generate.dto';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Prisma, PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { DateUtils } from '../scripts/dateUtils';

type Status = 'started' | 'progress' | 'completed';

@Injectable()
export class SubtopicService {
    private readonly fastapiUrl: string | undefined;

    constructor(
        private readonly prismaService: PrismaService,
        private readonly httpService: HttpService,
        private readonly configService: ConfigService
    ) {
        const node_env = this.configService.get<string>('APP_ENV') || 'development';

        if (node_env === 'development') {
            this.fastapiUrl = this.configService.get<string>('FASTAPI_URL_LOCAL') || undefined;
        }
        else {
            this.fastapiUrl = this.configService.get<string>('FASTAPI_URL') || undefined;
        }
    }

    async findSubtopics(
        subjectId: number,
        sectionId: number,
        topicId: number,
        weekOffset: number = 0
    ) {
        try {
            const subject = await this.prismaService.subject.findUnique({
                where: { id: subjectId },
            });

            if (!subject) {
                throw new BadRequestException('Przedmiot nie został znaleziony');
            }

            interface SubtopicWithProgress {
                id: number;
                name: string;
                importance: number;
                progresses: {
                    percent: number;
                    updatedAt: Date;
                }[];
                percent?: number;
                status?: Status;
            }

            let subtopics: SubtopicWithProgress[] = await this.prismaService.subtopic.findMany({
                where: { subjectId, sectionId, topicId },
                orderBy: { name: 'asc' },
                select: { 
                    id: true, 
                    name: true,
                    importance: true,
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

            subtopics = subtopics.map(sub => {
                const progresses = sub.progresses;
                
                let percent = 0;
                const alpha = 0.7;
                
                if (progresses.length > 0) {
                    let emaValue: number | null = null;
                    for (const progress of progresses) {
                        const currentPercent = Math.min(100, progress.percent);
                        if (emaValue === null) {
                            emaValue = currentPercent;
                        } else {
                            emaValue = (emaValue * (1 - alpha)) + (currentPercent * alpha);
                        }
                    }
                    percent = Math.min(100, Math.ceil(emaValue!));
                }
                
                return {
                    ...sub,
                    percent
                };
            });

            if (subtopics.length === 0) {
                const topic = await this.prismaService.topic.findUnique({
                    where: { id: topicId },
                    select: { id: true, name: true }
                });

                if (!topic) {
                    throw new BadRequestException('Temat nie został znaleziony');
                }

                subtopics = [{
                    id: topic.id,
                    name: topic.name,
                    importance: 0,
                    progresses: [],
                    percent: 0
                } as SubtopicWithProgress];
            }

            const updatedSubtopics = subtopics.map(sub => {
                const pct = sub.percent ?? 0;
                let status: Status;

                if (pct === 0) status = 'started';
                else if (pct < subject.threshold) status = 'progress';
                else status = 'completed';

                return { ...sub, status };
            });

            const totalSubtopics = updatedSubtopics.length || 1;

            let sumPercentCompleted = 0;
            let sumPercentProgress = 0;

            updatedSubtopics.forEach(sub => {
                const p = sub.percent ?? 0;
                if (sub.status == "completed")
                    sumPercentCompleted += p;
                else if (sub.status == "progress")
                    sumPercentProgress += p;
            });

            const maxPercent = totalSubtopics * 100;

            const percentCompleted = Math.min(Math.ceil((sumPercentCompleted / maxPercent) * 100), 100);
            const percentProgress = Math.min(Math.ceil((sumPercentProgress / maxPercent) * 100), 100);
            const percentStarted = Math.max(Math.min(100 - percentCompleted - percentProgress, 100), 0);

            const totalPercentByStatus: Record<Status, number> = {
                started: percentStarted ?? 0,
                progress: percentProgress ?? 0,
                completed: percentCompleted ?? 0,
            };

            if (
                totalPercentByStatus.started === 0 &&
                totalPercentByStatus.progress === 0 &&
                totalPercentByStatus.completed === 0
            ) {
                totalPercentByStatus.started = 100;
            }

            const now = new Date();
            const startOfWeek = DateUtils.getMonday(now, weekOffset);
            const endOfWeek = DateUtils.getSunday(now, weekOffset);

            const solvedTasksCount = await this.prismaService.task.count({
                where: {
                    topicId,
                    finished: true,
                    parentTaskId: null,
                    updatedAt: {
                        gte: startOfWeek,
                        lte: endOfWeek,
                    },
                },
            });

            const solvedTasksCountCompleted = await this.prismaService.task.count({
                where: {
                    topicId,
                    finished: true,
                    parentTaskId: null,
                    percent: {
                        gte: subject.threshold,
                    },
                    updatedAt: {
                        gte: startOfWeek,
                        lte: endOfWeek,
                    },
                },
            });

            let weekLabel = "bieżący";
            if (weekOffset < 0) weekLabel = `${weekOffset} tydz.`;

            const formatDate = (date: Date) => {
                const dd = String(date.getDate()).padStart(2, '0');
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                return `${dd}.${mm}`;
            };

            const startDateStr = formatDate(startOfWeek);
            const endDateStr = formatDate(endOfWeek);

            return {
                statusCode: 200,
                message: 'Pobrano listę podtematów pomyślnie',
                subtopics: updatedSubtopics,
                total: totalPercentByStatus,
                statistics: {
                    solvedTasksCountCompleted,
                    solvedTasksCount,
                    closedSubtopicsCount: null,
                    closedTopicsCount: null,
                    startDateStr,
                    weekLabel,
                    endDateStr,
                    prediction: null
                }
            };

        } catch (error) {
            throw new InternalServerErrorException(
                `Nie udało się pobrać podtematów: ${error}`
            );
        }
    }

    async findSubtopicById(
        subjectId: number,
        sectionId: number,
        topicId: number,
        id: number
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

            const topic = await this.prismaService.topic.findUnique({
                where: { id: topicId },
            });

            if (!topic) {
                throw new BadRequestException('Temat nie został znaleziony');
            }

            const subtopic = await this.prismaService.subtopic.findUnique({
                where: { id }
            });

            if (!subtopic) {
                throw new BadRequestException('Podtemat nie został znaleziony');
            }

            return {
                statusCode: 200,
                message: 'Pobrano podtemat pomyślnie',
                subtopic
            }
        }
        catch (error) {
            throw new InternalServerErrorException(`Nie udało się pobrać podtemat: ${error}`);
        }
    }

    async findSubtopicByName(
        subjectId: number,
        sectionId: number,
        topicId: number,
        name: string,
        prismaClient?: PrismaClient | Prisma.TransactionClient,
    ) {
        try {
            prismaClient = prismaClient || this.prismaService;

            const subject = await prismaClient.subject.findUnique({
                where: { id: subjectId },
            });

            if (!subject) {
                throw new BadRequestException('Przedmiot nie został znaleziony');
            }

            const section = await prismaClient.section.findUnique({
                where: { id: sectionId },
            });

            if (!section) {
                throw new BadRequestException('Dział nie został znaleziony');
            }

            const topic = await prismaClient.topic.findUnique({
                where: { id: topicId },
            });

            if (!topic) {
                throw new BadRequestException('Temat nie został znaleziony');
            }

            const subtopic = await prismaClient.subtopic.findFirst({
                where: {
                    name,
                    topicId,
                    sectionId,
                    subjectId
                }
            });

            if (!subtopic) {
                throw new BadRequestException('Podtemat nie został znaleziony');
            }

            return {
                statusCode: 200,
                message: 'Pobrano podtemat pomyślnie',
                subtopic
            }
        }
        catch (error) {
            throw new InternalServerErrorException(`Nie udało się pobrać podtemat: ${error}`);
        }
    }

    async updateSubtopic(
        subjectId: number,
        sectionId: number,
        topicId: number,
        id: number,
        data: SubtopicUpdateRequest
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

            const topic = await this.prismaService.topic.findUnique({
                where: { id: topicId },
            });

            if (!topic) {
                throw new BadRequestException('Temat nie został znaleziony');
            }

            const subtopic = await this.prismaService.subtopic.findUnique({
                where: { id }
            });

            if (!subtopic) {
                throw new BadRequestException('Podtemat nie został znaleziony');
            }

            const filteredData = Object.fromEntries(
                Object.entries(data).filter(([_, value]) => value !== undefined)
            );

            const updatedSubtopic = await this.prismaService.subtopic.update({
                where: { id },
                data: filteredData
            });

            return {
                statusCode: 200,
                message: 'Aktualizacja podtamatu udana',
                subtopic: updatedSubtopic
            }
        }
        catch (error) {
            throw new InternalServerErrorException('Nie udało się aktualizować podtemat');
        }
    }

    async createSubtopic(
        subjectId: number,
        sectionId: number,
        topicId: number,
        data: SubtopicCreateRequest
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

            const topic = await this.prismaService.topic.findUnique({
                where: { id: topicId },
            });

            if (!topic) {
                throw new BadRequestException('Temat nie został znaleziony');
            }

            const newSubtopic = await this.prismaService.subtopic.create({
                data: {
                    subjectId,
                    sectionId,
                    topicId,
                    name: data.name,
                }
            });

            return {
                statusCode: 201,
                message: 'Podtemat został dodany pomyślnie',
                subtopic: newSubtopic,
            }
        }
        catch (error) {
            throw new InternalServerErrorException(`Błąd dodawania podtematu: ${error}`);
        }
    }

    async createSubtopics(
        subjectId: number,
        sectionId: number,
        topicId: number,
        subtopics: [string, number][],
        prismaClient?: PrismaClient | Prisma.TransactionClient,
    ) {
        try {
            prismaClient = prismaClient || this.prismaService;

            const subject = await prismaClient.subject.findUnique({
                where: { id: subjectId },
            });

            if (!subject) {
                throw new BadRequestException('Przedmiot nie został znaleziony');
            }

            const section = await prismaClient.section.findUnique({
                where: { id: sectionId },
            });

            if (!section) {
                throw new BadRequestException('Dział nie został znaleziony');
            }

            const topic = await prismaClient.topic.findUnique({
                where: { id: topicId },
            });

            if (!topic) {
                throw new BadRequestException('Temat nie został znaleziony');
            }

            const formatted = subtopics.map((sub) => ({
                name: sub[0],
                importance: sub[1],
                topicId: topicId,
                sectionId: sectionId,
                subjectId: subjectId,
            }));

            await prismaClient.subtopic.createMany({
                data: formatted,
                skipDuplicates: true,
            });

            console.log(`Updated: ${topic.name}`);

            return {
                statusCode: 201,
                message: 'Podtematy zostały dodane',
            }
        }
        catch (error) {
            throw new InternalServerErrorException(`Błąd dodawania podtematu: ${error}`);
        }
    }

    async deleteSubtopic(
        subjectId: number,
        sectionId: number,
        topicId: number,
        id: number
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

            const topic = await this.prismaService.topic.findUnique({
                where: { id: topicId },
            });

            if (!topic) {
                throw new BadRequestException('Temat nie został znaleziony');
            }

            const subtopic = await this.prismaService.subtopic.findUnique({
                where: { id }
            });

            if (!subtopic) {
                throw new BadRequestException('Podtemat nie został znaleziony');
            }

            await this.prismaService.subtopic.delete({
                where: { id }
            });

            return {
                statusCode: 200,
                message: 'Podtemat został pomyślnie usunięty',
            };
        }
        catch (error) {
            throw new InternalServerErrorException(`Błąd usuwania podtematu: ${error}`);
        }
    }

    async deleteSubtopics(
        subjectId: number,
        sectionId: number,
        topicId: number,
        prismaClient?: PrismaClient | Prisma.TransactionClient,
    ) {
        try {
            prismaClient = prismaClient || this.prismaService;

            const subject = await prismaClient.subject.findUnique({
                where: { id: subjectId },
            });

            if (!subject) {
                throw new BadRequestException('Przedmiot nie został znaleziony');
            }

            const section = await prismaClient.section.findUnique({
                where: { id: sectionId },
            });

            if (!section) {
                throw new BadRequestException('Dział nie został znaleziony');
            }

            const topic = await prismaClient.topic.findUnique({
                where: { id: topicId },
            });

            if (!topic) {
                throw new BadRequestException('Temat nie został znaleziony');
            }

            await prismaClient.subtopic.deleteMany({
                where: {
                    subjectId,
                    sectionId,
                    topicId
                }
            });

            return {
                statusCode: 200,
                message: 'Podtematy zostały pomyślnie usunięte',
            };
        }
        catch (error) {
            throw new InternalServerErrorException(`Błąd usuwania podtematów: ${error}`);
        }
    }

    async subtopicsAIGenerate(
        subjectId: number,
        sectionId: number,
        topicId: number,
        data: SubtopicsAIGenerate,
        signal?: AbortSignal
    ) {
        const url = `${this.fastapiUrl}/admin/subtopics-generate`;

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
            data.literature = data.literature ?? topic.literature;

            if (!Array.isArray(data.subtopics) || !data.subtopics.every(item =>
                Array.isArray(item) &&
                item.length === 2 &&
                typeof item[0] === 'string' &&
                typeof item[1] === 'number'
            )) {
                throw new BadRequestException('Subtopics musi być listą par [string, number]');
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
                !Array.isArray(r.subtopics) ||
                !Array.isArray(r.errors) ||
                typeof r.attempt !== 'number' ||
                typeof r.literature !== 'string'
            ) {
                throw new BadRequestException('Niepoprawna struktura odpowiedzi z serwera.');
            }

            if (!r.subtopics.every((item: any) =>
                Array.isArray(item) &&
                item.length === 2 &&
                typeof item[0] === 'string' &&
                typeof item[1] === 'number'
            )) {
                throw new BadRequestException('Subtopics musi być listą par [string, number]');
            }

            if (!r.errors.every((item: any) => typeof item === 'string')) {
                throw new BadRequestException('Errors musi być listą stringów');
            }

            return {
                statusCode: 201,
                message: "Generacja treści zadania udana",
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

    async topicExpansionAIGenerate(
        subjectId: number,
        sectionId: number,
        topicId: number,
        data: TopicExpansionAIGenerate,
        signal?: AbortSignal
    ) {
        const url = `${this.fastapiUrl}/admin/topic-expansion-generate`;

        try {
            const subject = await this.prismaService.subject.findUnique({ where: { id: subjectId } });
            if (!subject) throw new BadRequestException('Przedmiot nie został znaleziony');

            const section = await this.prismaService.section.findUnique({ where: { id: sectionId } });
            if (!section) throw new BadRequestException('Dział nie został znaleziony');

            const topic = await this.prismaService.topic.findUnique({ where: { id: topicId } });
            if (!topic) throw new BadRequestException('Temat nie został znaleziony');

            const subtopics = await this.prismaService.subtopic.findMany({
                where: { topicId: topicId },
                select: { name: true },
            });

            const subtopicNames: string[] = subtopics.map(sub => sub.name);

            data.subject = data.subject ?? subject.name;
            data.section = data.section ?? section.name;
            data.topic = data.topic ?? topic.name;
            data.literature = data.literature ?? topic.literature;
            data.note = data.note ?? topic.note;
            data.subtopics = data.subtopics ?? subtopicNames;

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
                !Array.isArray(r.subtopics) ||
                !Array.isArray(r.errors) ||
                typeof r.attempt !== 'number' ||
                typeof r.literature !== 'string' ||
                typeof r.note !== 'string'
            ) {
                throw new BadRequestException('Niepoprawna struktura odpowiedzi z serwera.');
            }

            if (!r.subtopics.every((item: any) => typeof item === 'string')) {
                throw new BadRequestException('Subtopics musi być listą stringów');
            }

            if (!r.errors.every((item: any) => typeof item === 'string')) {
                throw new BadRequestException('Errors musi być listą stringów');
            }

            return {
                statusCode: 201,
                message: "Generacja właściwości tematu udana",
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
}
