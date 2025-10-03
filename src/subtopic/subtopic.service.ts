import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubtopicCreateRequest, SubtopicUpdateRequest } from '../subtopic/dto/subtopic-request.dto';
import { SubtopicsAIGenerate } from './dto/subtopics-generate.dto';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Prisma, PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

type Status = 'blocked' | 'started' | 'progress' | 'completed';

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

            let subtopics = await this.prismaService.subtopic.findMany({
                where: { subjectId, sectionId, topicId },
                orderBy: { name: 'asc' },
                select: { id: true, name: true, percent: true, blocked: true, importance: true }
            });

            if (subtopics.length === 0) {
                const topic = await this.prismaService.topic.findUnique({
                    where: { id: topicId },
                    select: { id: true, name: true, percent: true, blocked: true }
                });

                if (!topic) {
                    throw new BadRequestException('Temat nie został znaleziony');
                }

                subtopics = [{ ...topic, importance: 0 }];
            }

            const updatedSubtopics = subtopics.map(sub => {
                const pct = sub.percent ?? 0;
                let status: Status;

                if (sub.blocked) status = 'blocked';
                else if (pct === 0) status = 'started';
                else if (pct < subject.threshold) status = 'progress';
                else status = 'completed';

                return { ...sub, status };
            });

            const totalSubtopics = updatedSubtopics.length || 1;
            const counts: Record<Status, number> = {
                blocked: 0,
                started: 0,
                progress: 0,
                completed: 0
            };

            updatedSubtopics.forEach(sub => {
                counts[sub.status] += 1;
            });

            const totalPercentByStatus: Record<Status, number> = {
                blocked: (counts.blocked / totalSubtopics) * 100,
                started: (counts.started / totalSubtopics) * 100,
                progress: (counts.progress / totalSubtopics) * 100,
                completed: (counts.completed / totalSubtopics) * 100
            };

            const now = new Date();
            let startOfWeek: Date;
            let endOfWeek: Date;

            if (weekOffset === 0) {
                startOfWeek = new Date(0);
                endOfWeek = new Date(now);
            } else {
                const day = now.getDay();
                const currentMonday = new Date(now);
                currentMonday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
                currentMonday.setHours(0, 0, 0, 0);

                startOfWeek = new Date(currentMonday);
                startOfWeek.setDate(currentMonday.getDate() + 7 * weekOffset);

                endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(startOfWeek.getDate() + 6);
                endOfWeek.setHours(23, 59, 59, 999);
            }

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

            let weekLabel = "bieżący" 
            if (weekOffset < 0)
                weekLabel = `${weekOffset} tydz.`

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
                typeof r.attempt !== 'number'
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
}
