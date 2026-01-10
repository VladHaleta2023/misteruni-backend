import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubtopicCreateRequest, SubtopicUpdateRequest } from '../subtopic/dto/subtopic-request.dto';
import { SubtopicsAIGenerate, SubtopicsStatusAIGenerate, TopicExpansionAIGenerate } from './dto/subtopics-generate.dto';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Prisma, PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { DateUtils } from '../scripts/dateUtils';
import { TimezoneService } from '../timezone/timezone.service';

type Status = 'started' | 'progress' | 'completed';

export enum SubjectDetailLevel {
  MANDATORY = "MANDATORY",
  DESIRABLE = "DESIRABLE",
  OPTIONAL = "OPTIONAL"
}

export interface SubtopicTask {
    id: number;
    text: string;
    percent: number;
    date: string;
}

export interface SubtopicWithProgressResponse {
    id: number;
    name: string;
    importance: number;
    tasks: SubtopicTask[];
    percent?: number;
    status?: Status;
}

@Injectable()
export class SubtopicService {
    private readonly fastapiUrl: string | undefined;

    constructor(
        private readonly prismaService: PrismaService,
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
        private readonly timezoneService: TimezoneService
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
        userId: number,
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

            const topic = await this.prismaService.topic.findUnique({
                where: { id: topicId },
                select: { 
                    id: true, 
                    name: true, 
                    note: true,
                    partId: true,
                    frequency: true
                }
            });

            if (!topic) {
                throw new BadRequestException('Temat nie został znaleziony');
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

            const subtopicsFromDb = await this.prismaService.subtopic.findMany({
                where: { subjectId, sectionId, topicId },
                orderBy: { name: 'asc' },
                select: { 
                    id: true, 
                    name: true,
                    importance: true,
                    progresses: {
                        where: {
                            userId,
                            task: { finished: true, userId }
                        },
                        select: {
                            percent: true,
                            updatedAt: true,
                            task: {
                                select: {
                                    id: true,
                                    text: true,
                                    percent: true,
                                    updatedAt: true,
                                }
                            }
                        },
                        orderBy: { updatedAt: 'asc' }
                    }
                }
            });

            const uniqueTasksMap = new Map<number, any>();
            
            subtopicsFromDb.forEach(sub => {
                sub.progresses.forEach(progress => {
                    const taskId = progress.task.id;
                    
                    if (!uniqueTasksMap.has(taskId)) {
                        const localDate = this.timezoneService.utcToLocal(progress.task.updatedAt);
                        const dd = String(localDate.getDate()).padStart(2, '0');
                        const mm = String(localDate.getMonth() + 1).padStart(2, '0');
                        const yyyy = localDate.getFullYear();
                        const dateStr = `${dd}.${mm}.${yyyy}`;

                        let taskStatus: Status = "started";
                        if (progress.task.percent === 0) {
                            taskStatus = 'started';
                        } else if (progress.task.percent < threshold) {
                            taskStatus = 'progress';
                        } else {
                            taskStatus = 'completed';
                        }

                        uniqueTasksMap.set(taskId, {
                            id: progress.task.id,
                            text: progress.task.text,
                            percent: Math.round(progress.task.percent),
                            date: dateStr,
                            status: taskStatus,
                            subtopics: [{
                                id: sub.id,
                                name: sub.name,
                                percent: Math.round(progress.percent)
                            }]
                        });
                    } else {
                        const existingTask = uniqueTasksMap.get(taskId);
                        if (!existingTask.subtopics.some(st => st.id === sub.id)) {
                            existingTask.subtopics.push({
                                id: sub.id,
                                name: sub.name,
                                percent: Math.round(progress.percent)
                            });
                        }
                    }
                });
            });

            const allUniqueTasks = Array.from(uniqueTasksMap.values()).sort((a, b) => {
                return new Date(b.date.split('.').reverse().join('-')).getTime() - 
                    new Date(a.date.split('.').reverse().join('-')).getTime();
            });

            let subtopics: SubtopicWithProgressResponse[] = subtopicsFromDb.map(sub => {
                const tasksForThisSubtopic = allUniqueTasks
                    .filter(task => task.subtopics.some(st => st.id === sub.id))
                    .map(task => {
                        const { subtopics, ...taskWithoutSubtopics } = task;
                        return taskWithoutSubtopics;
                    });

                const progresses = sub.progresses;
                let percent = 0;
                const alpha = 0.7;
                
                if (progresses.length > 0) {
                    const sortedProgresses = [...progresses].sort((a, b) => 
                        new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
                    );
                    
                    let emaValue: number | null = null;
                    for (const progress of sortedProgresses) {
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
                    id: sub.id,
                    name: sub.name,
                    importance: sub.importance,
                    tasks: tasksForThisSubtopic,
                    percent
                };
            });

            if (subtopics.length === 0) {
                subtopics = [{
                    id: topic.id,
                    name: topic.name,
                    importance: 0,
                    tasks: [],
                    percent: 0
                }];
            }

            const updatedSubtopics = subtopics.map(sub => {
                const pct = sub.percent ?? 0;
                let status: Status;

                if (pct === 0) status = 'started';
                else if (pct < threshold) status = 'progress';
                else status = 'completed';

                return { ...sub, status };
            });

            let topicPercent = 0;

            if (updatedSubtopics.length > 0) {
                const totalPercent = updatedSubtopics.reduce((acc, s) => acc + (s.percent ?? 0), 0);
                topicPercent = Math.ceil(totalPercent / updatedSubtopics.length);
            }

            let topicStatus: Status;
            if (topicPercent === 0) {
                topicStatus = 'started';
            } else if (topicPercent >= threshold) {
                topicStatus = 'completed';
            } else {
                topicStatus = 'progress';
            }

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

            const percentCompleted = Math.min(Math.round((sumPercentCompleted / maxPercent) * 100), 100);
            const percentProgress = Math.min(Math.round((sumPercentProgress / maxPercent) * 100), 100);
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

            const startOfWeekUTC = this.timezoneService.localToUTC(startOfWeek);
            const endOfWeekUTC = this.timezoneService.localToUTC(endOfWeek);

            const solvedTasksCount = await this.prismaService.task.count({
                where: {
                    userId,
                    topicId,
                    finished: true,
                    parentTaskId: null,
                    updatedAt: {
                        gte: startOfWeekUTC,
                        lte: endOfWeekUTC,
                    },
                },
            });

            const solvedTasksCountCompleted = await this.prismaService.task.count({
                where: {
                    userId,
                    topicId,
                    finished: true,
                    parentTaskId: null,
                    percent: {
                        gte: threshold,
                    },
                    updatedAt: {
                        gte: startOfWeekUTC,
                        lte: endOfWeekUTC,
                    },
                },
            });

            let weekLabel = "bieżący";
            if (weekOffset < 0) weekLabel = `${weekOffset} tydz.`;

            const formatDate = (date: Date) => {
                const localDate = this.timezoneService.utcToLocal(date);
                const dd = String(localDate.getDate()).padStart(2, '0');
                const mm = String(localDate.getMonth() + 1).padStart(2, '0');
                return `${dd}.${mm}`;
            };

            const startDateStr = formatDate(startOfWeek);
            const endDateStr = formatDate(endOfWeek);

            return {
                statusCode: 200,
                message: 'Pobrano listę podtematów pomyślnie',
                topic: {
                    id: topic.id,
                    name: topic.name,
                    note: topic.note,
                    partId: topic.partId,
                    frequency: topic.frequency,
                    percent: topicPercent,
                    status: topicStatus
                },
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

    async findAdminSubtopicsStatus(
        subjectId: number,
        sectionId: number,
        topicId: number,
    ) {
        try {
            const subject = await this.prismaService.subject.findUnique({
                where: { id: subjectId },
            });

            if (!subject) {
                throw new BadRequestException('Przedmiot nie został znaleziony');
            }

            const topic = await this.prismaService.topic.findUnique({
                where: { id: topicId }
            });

            if (!topic) {
                throw new BadRequestException('Temat nie został znaleziony');
            }

            const subtopics = await this.prismaService.subtopic.findMany({
                where: { subjectId, sectionId, topicId },
                orderBy: { name: 'asc' }
            });

            const formattedSubtopics = subtopics.map(st => [st.name, st.detailLevel]);

            return {
                statusCode: 200,
                message: 'Pobrano listę statusów podtematów pomyślnie',
                subtopics: formattedSubtopics
            };

        } catch (error) {
            throw new InternalServerErrorException(
                `Nie udało się pobrać statusów podtematów: ${error}`
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
        prismaClient: PrismaClient | Prisma.TransactionClient = this.prismaService,
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

    async updateSubtopics(
        subjectId: number,
        sectionId: number,
        topicId: number,
        subtopics: [string, string][],
        prismaClient: PrismaClient | Prisma.TransactionClient = this.prismaService,
    ) {
        try {
            const subject = await prismaClient.subject.findUnique({ where: { id: subjectId } });
            if (!subject) throw new BadRequestException('Przedmiot nie został znaleziony');

            const section = await prismaClient.section.findUnique({ where: { id: sectionId } });
            if (!section) throw new BadRequestException('Dział nie został znaleziony');

            const topic = await prismaClient.topic.findUnique({ where: { id: topicId } });
            if (!topic) throw new BadRequestException('Temat nie został znaleziony');

            if (subtopics.length === 0) {
                return {
                    statusCode: 200,
                    message: 'Brak podtematów do aktualizacji'
                };
            }

            const allSubtopics = await prismaClient.subtopic.findMany({
                where: {
                    topicId,
                    sectionId,
                    subjectId,
                }
            });

            const names = subtopics.map(([name]) => name);

            const subtopicsToUpdate = allSubtopics.filter(st => 
                names.includes(st.name)
            );

            const levelMap = new Map(subtopics);

            const updates = subtopicsToUpdate
                .filter(subtopic => {
                    const newLevel = levelMap.get(subtopic.name);
                    return newLevel && subtopic.detailLevel !== newLevel;
                })
                .map(subtopic => {
                    const newLevel = levelMap.get(subtopic.name)!;
                    return prismaClient.subtopic.update({
                        where: { id: subtopic.id },
                        data: { detailLevel: newLevel as any }
                    });
                });

            if (updates.length > 0) {
                await Promise.all(updates);
            }

            return {
                statusCode: 200,
                message: 'Podtematy zostały zaktualizowane',
            };
        } catch (error) {
            console.error('Błąd aktualizacji podtematów:', error);
            throw new InternalServerErrorException(`Błąd aktualizacji podtematów: ${error}`);
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
                message: "Generacja podtematów udana",
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

    async subtopicsStatusAIGenerate(subjectId: number,
        sectionId: number,
        topicId: number,
        data: SubtopicsStatusAIGenerate,
        signal?: AbortSignal
    ) {
        const url = `${this.fastapiUrl}/admin/subtopics-status-generate`;

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

            if (!Array.isArray(data.subtopics) || !data.subtopics.every(item =>
                Array.isArray(item) &&
                item.length === 2 &&
                typeof item[0] === 'string' &&
                typeof item[1] === 'string'
            )) {
                throw new BadRequestException('Subtopics musi być listą par [string, string]');
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
                typeof r.attempt !== 'number'
            ) {
                throw new BadRequestException('Niepoprawna struktura odpowiedzi z serwera.');
            }

            if (!r.subtopics.every((item: any) =>
                Array.isArray(item) &&
                item.length === 2 &&
                typeof item[0] === 'string' &&
                typeof item[1] === 'string'
            )) {
                throw new BadRequestException('Subtopics musi być listą par [string, string]');
            }

            if (!r.errors.every((item: any) => typeof item === 'string')) {
                throw new BadRequestException('Errors musi być listą stringów');
            }

            return {
                statusCode: 201,
                message: "Generacja statusów podtematów udana",
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