import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubtopicCreateRequest, SubtopicUpdateRequest } from '../subtopic/dto/subtopic-request.dto';
import { FrequencyAIGenerate, SubtopicsAIGenerate, SubtopicsStatusAIGenerate, TopicExpansionAIGenerate } from './dto/subtopics-generate.dto';
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
        topicId: number
    ) {
        try {
            const data = await this.prismaService.$queryRaw<any[]>`
                WITH 
                user_settings AS (
                    SELECT COALESCE(threshold, 50) as threshold,
                        COALESCE("detailLevel", 'MANDATORY') as detail_level
                    FROM "UserSubject"
                    WHERE "userId" = ${userId} AND "subjectId" = ${subjectId}
                    LIMIT 1
                ),
                topic_info AS (
                    SELECT 
                        t.id, t.name, t.note, t."partId", t.frequency,
                        COALESCE(ut.percent, 0) as percent,
                        (SELECT threshold FROM user_settings) as threshold
                    FROM "Topic" t
                    LEFT JOIN "UserTopic" ut ON ut."userId" = ${userId} 
                        AND ut."subjectId" = ${subjectId}
                        AND ut."topicId" = t.id
                    WHERE t.id = ${topicId}
                )
                SELECT 
                    -- Тема
                    ti.id as "topicId",
                    ti.name as "topicName",
                    ti.note as "topicNote",
                    ti."partId" as "topicPartId",
                    ti.frequency as "topicFrequency",
                    ti.percent as "topicPercent",
                    CASE 
                        WHEN ti.percent >= ti.threshold THEN 'completed'
                        WHEN ti.percent > 0 THEN 'progress'
                        ELSE 'started'
                    END as "topicStatus",
                    
                    -- Подтема
                    s.id as "subtopicId",
                    s.name as "subtopicName",
                    s.importance,
                    s."partId",
                    COALESCE(us.percent, 0) as "subtopicPercent",
                    CASE 
                        WHEN COALESCE(us.percent, 0) >= ti.threshold THEN 'completed'
                        WHEN COALESCE(us.percent, 0) > 0 THEN 'progress'
                        ELSE 'started'
                    END as "subtopicStatus"
                    
                FROM topic_info ti
                LEFT JOIN "Subtopic" s ON s."topicId" = ti.id
                    AND s."sectionId" = ${sectionId}
                    AND s."subjectId" = ${subjectId}
                    AND s."detailLevel"::text = ANY(
                        CASE (SELECT detail_level FROM user_settings)
                            WHEN 'OPTIONAL' THEN ARRAY['MANDATORY', 'DESIRABLE', 'OPTIONAL']::text[]
                            WHEN 'DESIRABLE' THEN ARRAY['MANDATORY', 'DESIRABLE']::text[]
                            ELSE ARRAY['MANDATORY']::text[]
                        END
                    )
                LEFT JOIN "UserSubtopic" us ON us."subtopicId" = s.id
                    AND us."userId" = ${userId}
                    AND us."subjectId" = ${subjectId}
                WHERE ti.id IS NOT NULL
                ORDER BY s."partId" ASC
            `;

            // Проверяем что тема найдена
            if (data.length === 0 || !data[0].topicId) {
                throw new BadRequestException('Temat nie został znaleziony');
            }

            // Первая строка содержит данные темы
            const topicRow = data[0];
            const topic = {
                id: topicRow.topicId,
                name: topicRow.topicName,
                note: topicRow.topicNote,
                partId: topicRow.topicPartId,
                frequency: topicRow.topicFrequency,
                percent: topicRow.topicPercent,
                status: topicRow.topicStatus as Status
            };

            // Формируем подтемы (фильтруем строки где есть subtopicId)
            const subtopics = data
                .filter(row => row.subtopicId !== null)
                .map(row => ({
                    id: row.subtopicId,
                    name: row.subtopicName,
                    importance: row.importance ?? 0,
                    percent: row.subtopicPercent,
                    status: row.subtopicStatus as Status,
                    tasks: []
                }));

            // Статистика
            const totalCount = subtopics.length;
            let started = 0;
            let progress = 0;
            let completed = 0;

            for (const s of subtopics) {
                if (s.status === 'started') started++;
                else if (s.status === 'progress') progress++;
                else if (s.status === 'completed') completed++;
            }

            const total = totalCount === 0
                ? { started: 100, progress: 0, completed: 0 }
                : {
                    started: Math.round((started / totalCount) * 100),
                    progress: Math.round((progress / totalCount) * 100),
                    completed: Math.round((completed / totalCount) * 100),
                };

            return {
                statusCode: 200,
                message: 'Pobrano listę podtematów pomyślnie',
                topic,
                subtopics,
                total,
                prediction: null,
            };
        } catch (error) {
            console.error('Error in findSubtopics:', error);
            throw new InternalServerErrorException(
                `Nie udało się pobrać podtematów: ${error.message || error}`
            );
        }
    }

    async findAdminSubtopics(
        subjectId: number,
        sectionId: number,
        topicId: number
    ) {
        try {
            const data = await this.prismaService.$queryRaw<any[]>`
                SELECT 
                    -- Тема
                    t.id as "topicId",
                    t.name as "topicName",
                    t.note as "topicNote",
                    t."partId" as "topicPartId",
                    t.frequency as "topicFrequency",
                    
                    -- Подтема
                    s.id as "subtopicId",
                    s.name as "subtopicName",
                    s.importance,
                    s."partId",
                    s."detailLevel"
                    
                FROM "Topic" t
                LEFT JOIN "Subtopic" s ON s."topicId" = t.id
                    AND s."sectionId" = ${sectionId}
                    AND s."subjectId" = ${subjectId}
                WHERE t.id = ${topicId}
                ORDER BY s."partId" ASC
            `;

            if (data.length === 0 || !data[0].topicId) {
                throw new BadRequestException('Temat nie został znaleziony');
            }

            const topicRow = data[0];
            const topic = {
                id: topicRow.topicId,
                name: topicRow.topicName,
                note: topicRow.topicNote,
                partId: topicRow.topicPartId,
                frequency: topicRow.topicFrequency,
            };

            const subtopics = data
                .filter(row => row.subtopicId !== null)
                .map(row => ({
                    id: row.subtopicId,
                    name: row.subtopicName,
                    importance: row.importance ?? 0,
                    detailLevel: row.detailLevel,
                    partId: row.partId,
                    tasks: []
                }));

            return {
                statusCode: 200,
                message: 'Pobrano wszystkie podtematy pomyślnie',
                topic,
                subtopics,
                totalCount: subtopics.length,
            };
        } catch (error) {
            console.error('Error in getAllSubtopics:', error);
            throw new InternalServerErrorException(
                `Nie udało się pobrać podtematów: ${error.message || error}`
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
                orderBy: { partId: 'asc' }
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
                message: "Generacja ważności podtematów udana",
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
                message: "Generacja notatki tematu udana",
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

    async frequencyAIGenerate(
        subjectId: number,
        sectionId: number,
        topicId: number,
        data: FrequencyAIGenerate,
        signal?: AbortSignal
    ) {
        const url = `${this.fastapiUrl}/admin/frequency-generate`;

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
            data.frequency = data.frequency ?? topic.frequency;
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
                !Array.isArray(r.outputSubtopics) ||
                !Array.isArray(r.errors) ||
                typeof r.attempt !== 'number' ||
                typeof r.literature !== 'string' ||
                typeof r.frequency !== 'number'
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
                message: "Generacja częstotliwości tematu udana",
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