import { BadRequestException, forwardRef, HttpException, HttpStatus, Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LiteratureAIGenerate, LiteratureUpdateRequest, SubjectCreateRequest, SubjectUpdateRequest } from './dto/subject-request.dto';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { StorageService } from '../storage/storage.service';
import axios from "axios";
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { File } from '../file.type';
import { TaskService } from '../task/task.service';
import { ExamService } from '../exam/exam.service';
import { SectionService } from '../section/section.service';
import { TimezoneService } from '../timezone/timezone.service';
import { SubjectDetailLevel } from '@prisma/client';

@Injectable()
export class SubjectService {
    private readonly fastapiUrl: string | undefined;

    constructor(
        private readonly prismaService: PrismaService,
        private readonly httpService: HttpService,
        private readonly storageService: StorageService,
        private readonly configService: ConfigService,
        private readonly examService: ExamService,
        private readonly sectionService: SectionService,
        private readonly timezoneService: TimezoneService,
        @Inject(forwardRef(() => TaskService))
        private readonly taskService: TaskService,
    ) {
        const node_env = this.configService.get<string>('APP_ENV') || 'development';

        if (node_env === 'development') {
            this.fastapiUrl = this.configService.get<string>('FASTAPI_URL_LOCAL') || undefined;
        }
        else {
            this.fastapiUrl = this.configService.get<string>('FASTAPI_URL') || undefined;
        }
    }

    async deleteAllSectionsBySubjectId(id: number) {
        try {
            await this.prismaService.section.deleteMany({
                where: {
                    subjectId: id
                }
            });
        }
        catch (error) {
            console.error('Błąd usuwania działów przedmiota:', error);
            throw error;
        }
    }

    async subjectAIPlanGenerate(id: number, prompt: string) {
        const url = `${this.fastapiUrl}/admin/full-plan-generate`;

        try {
            const response$ = this.httpService.post(url, { prompt });
            const response = await firstValueFrom(response$);

            if (!response.data || !response.data.sections) {
                throw new BadRequestException('Niepoprawna struktura odpowiedzi z serwera.');
            }

            return await this.prismaService.$transaction(async (tx) => {
                await tx.section.deleteMany({
                    where: { subjectId: id },
                });

                for (let i = 0; i < response.data.sections.length; i++) {
                    const section = response.data.sections[i];

                    const createdSection = await tx.section.create({
                        data: {
                            name: section.section,
                            subjectId: id,
                            partId: i + 1,
                        },
                    });

                    if (section.topics && section.topics.length > 0) {
                        const topicsData = section.topics.map((topicName: string, index: number) => ({
                            name: topicName,
                            sectionId: createdSection.id,
                            subjectId: id,
                            partId: index + 1,
                        }));

                        await tx.topic.createMany({
                            data: topicsData,
                        });
                    }
                }

                return {
                    statusCode: 201,
                    message: "Generacja treści przedmiotu udana",
                    sections: response.data.sections
                };
            }, {
                timeout: 900000
            });
        }
        catch (error) {
            if (error.response && error.response.data) {
                const fastApiErrorMessage = error.response.data.detail || JSON.stringify(error.response.data);
                throw new HttpException(`Błąd API: ${fastApiErrorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
            }
            throw new InternalServerErrorException(`Błąd serwisu generującego: ${error.message || error.toString()}`);
        }
    }
    
    async findSubjects(withSections: boolean = true) {
        try {
            if (!withSections) {
            const subjects = await this.prismaService.subject.findMany({
                orderBy: { createdAt: 'asc' },
            });

            return {
                statusCode: 200,
                message: 'Pobrano listę przedmiotów pomyślnie',
                subjects: subjects.map(s => ({ ...s, sections: [] })),
            };
            }

            const subjects = await this.prismaService.$queryRaw<
            {
                id: number;
                name: string;
                createdAt: Date;
                sections: {
                id: number;
                name: string;
                partId: number;
                topics: {
                    id: number;
                    name: string;
                    partId: number;
                }[];
                }[];
            }[]
            >`
            SELECT
            s.id,
            s.name,
            s."createdAt",
            COALESCE(
                (
                SELECT json_agg(
                    json_build_object(
                    'id', sec.id,
                    'name', sec.name,
                    'partId', sec."partId",
                    'topics', COALESCE(
                        (
                        SELECT json_agg(
                            json_build_object(
                            'id', t.id,
                            'name', t.name,
                            'partId', t."partId"
                            )
                            ORDER BY t."partId"
                        )
                        FROM "Topic" t
                        WHERE t."sectionId" = sec.id
                        ),
                        '[]'::json
                    )
                    )
                    ORDER BY sec."partId"
                )
                FROM "Section" sec
                WHERE sec."subjectId" = s.id
                ),
                '[]'::json
            ) AS sections
            FROM "Subject" s
            ORDER BY s."createdAt" ASC;
            `;

            return {
                statusCode: 200,
                message: 'Pobrano listę przedmiotów pomyślnie',
                subjects,
            };
        } catch (error) {
            throw new BadRequestException('Nie udało się pobrać przedmiotów');
        }
    }

    async findSubjectsForUser(
        userId: number
    ) {
        type AvailableSubject = {
            id: number;
            name: string;
        }

        try {
            const availableSubjects = await this.prismaService.$queryRaw<AvailableSubject[]>`
                SELECT 
                    s.id,
                    s.name
                FROM "Subject" s
                WHERE s."isVisible" = true
                AND NOT EXISTS (
                    SELECT 1 
                    FROM "UserSubject" us 
                    WHERE us."subjectId" = s.id 
                    AND us."userId" = ${userId}
                )
                ORDER BY s."createdAt" ASC
            `;

            return {
                statusCode: 200,
                message: 'Pobrano listę przedmiotów dla użytkownika pomyślnie',
                subjects: availableSubjects,
            };
        } catch (error) {
            throw new BadRequestException('Nie udało się pobrać przedmiotów dla użytkownika');
        }
    }

    async findSubjectById(id: number) {
        try {
            const subject = await this.prismaService.subject.findUnique({
                where: { id },
            });

            if (!subject) {
                return {
                    statusCode: 404,
                    message: `Przedmiot nie został znaleziony`,
                    subject: null,
                };
            }

            return {
                statusCode: 200,
                message: "Przedmiot został pomyślnie pobrany",
                subject: {
                    ...subject,
                    examPromptOwn: true,
                    solutionGuidePromptOwn: true,
                    vocabularyGuidePromptOwn: true,
                    literaturePromptOwn: true,
                    subtopicsPromptOwn: true,
                    subtopicsStatusPromptOwn: true,
                    questionPromptOwn: true,
                    audioQuestionPromptOwn: true,
                    writingQuestionPromptOwn: true,
                    solutionPromptOwn: true,
                    answersPromptOwn: true,
                    closedSubtopicsPromptOwn: true,
                    audioClosedPromptOwn: true,
                    writingClosedPromptOwn: true,
                    vocabluaryPromptOwn: true,
                    wordsPromptOwn: true,
                    chatPromptOwn: true,
                    audioChatPromptOwn: true,
                    topicExpansionPromptOwn: true,
                    topicWritingExpansionPromptOwn: true,
                    topicFrequencyPromptOwn: true,
                    chronologyPromptOwn: true,
                    theoryPromptOwn: true
                }
            };
        } catch (error) {
            console.error(`Nie udało się pobrać przedmiotu:`, error);
            throw new InternalServerErrorException("Błąd podczas pobierania przedmiotu");
        }
    }

    async createSubject(data: SubjectCreateRequest) {
        try {
            const newSubject = await this.prismaService.subject.create({
                data: {
                    name: data.name,
                    prompt: data.prompt || '',
                },
            });

            return {
                statusCode: 201,
                message: 'Przedmiot został pomyślnie dodany',
                subject: newSubject,
            };
        }
        catch (error) {
            console.error(`Nie udało się dodać przedmiot:`, error);
            throw new InternalServerErrorException('Błąd podczas dodawania przedmiotu');
        }
    }

    async updateSubject(id: number, data: SubjectUpdateRequest) {
        try {
            const existing = await this.prismaService.subject.findUnique({ where: { id } });
            if (!existing) {
                return {
                    statusCode: 404,
                    message: `Przedmiot nie został znaleziony`,
                };
            }

            const filteredData = Object.fromEntries(
                Object.entries(data).filter(([_, value]) => value !== undefined)
            );

            const updatedSubject = await this.prismaService.subject.update({
                where: { id },
                data: filteredData
            });

            return {
                statusCode: 200,
                message: 'Przedmiot został pomyślnie zaktualizowany',
                subject: updatedSubject,
            };
        }
        catch (error) {
            console.error(`Nie udało się zaktualizować przedmiot:`, error);
            throw new InternalServerErrorException('Błąd podczas aktualizacji przedmiotu');
        }
    }

    private extractKeyFromUrl(fileUrl: string): string | null {
        try {
            const url = new URL(fileUrl);
            return decodeURIComponent(url.pathname.substring(1));
        } catch (e) {
            console.error('Nie udało się wyciągnąć klucza z URL:', e);
            return null;
        }
    }

    async deleteSubject(id: number) {
        try {
            const existing = await this.prismaService.subject.findUnique({ where: { id } });
            if (!existing) {
                return {
                    statusCode: 404,
                    message: `Przedmiot nie został znaleziony`,
                };
            }

            if (existing.url) {
                const key = this.extractKeyFromUrl(existing.url);
                if (key) {
                    try {
                        await this.storageService.deleteFile(key);
                    } catch (err) {
                        console.error('Nie udało się usunąć Url przedmiotu:', err);
                    }
                }
            }

            await this.prismaService.subject.delete({ where: { id } });

            return {
                statusCode: 200,
                message: 'Przedmiot został pomyślnie usunięty',
            };
        }
        catch (error) {
            console.error(`Nie udało się usunąć przedmiot:`, error);
            throw new InternalServerErrorException('Błąd podczas usuwania przedmiotu');
        }
    }

    async uploadFileSubject(
        id: number,
        file?: File,
        url?: string,
    ) {
        try {
            const subject = await this.prismaService.subject.findUnique({ where: { id } });
            if (!subject) {
                return {
                    statusCode: 404,
                    message: 'Przedmiot nie został znaleziony',
                    public_url: '',
                };
            }

            if (subject.url) {
                const oldKey = this.extractKeyFromUrl(subject.url);
                if (oldKey) {
                    try {
                        await this.storageService.deleteFile(oldKey);
                    } catch (err) {
                        console.error('Nie udało się usunąć stary plik z S3:', err);
                    }
                }
            }

            let publicUrl: string;

            if (file) {
                const timestamp = Date.now();
                const extension = path.extname(file.originalname) || '.jpg';
                const fileKey = `subject_${id}_${timestamp}${extension}`;

                publicUrl = await this.storageService.uploadFile(file, fileKey);
            } else if (url) {
                const response = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer' });
                const contentType = response.headers['content-type'];
                if (!contentType || !contentType.startsWith('image/')) {
                    throw new BadRequestException('Invalid file type from URL. Only images are allowed.');
                }

                const timestamp = Date.now();
                const fileExtension = path.extname(new URL(url).pathname) || '.jpg';
                const fileKey = `subject_${id}_${timestamp}${fileExtension}`;

                publicUrl = await this.storageService.uploadBuffer(
                    Buffer.from(response.data),
                    fileKey,
                    contentType,
                );
            } else {
                throw new BadRequestException('Either file or url must be provided');
            }

            await this.prismaService.subject.update({
                where: { id },
                data: { url: publicUrl },
            });

            return {
                statusCode: 200,
                message: 'Plik został pomyślnie załadowany i URL zaktualizowany',
                public_url: publicUrl,
            };
        } catch (error) {
            console.error('Błąd podczas uploadu pliku:', error);
            throw new InternalServerErrorException('Błąd podczas uploadu pliku');
        }
    }

    async findAdminSections(
        subjectId: number,
        minSectionPart = 1
    ) {
        try {
            const subject = await this.prismaService.subject.findUnique({
                where: { id: subjectId },
            });

            if (!subject) {
                throw new BadRequestException('Przedmiot nie został znaleziony');
            }

            const sections = await this.prismaService.section.findMany({
                where: {
                    subjectId,
                    partId: { gte: minSectionPart },
                },
                include: {
                    topics: {
                        include: {
                            subtopics: {
                                orderBy: { partId: 'asc' },
                            }
                        },
                        orderBy: { partId: 'asc' },
                    }
                },
                orderBy: { partId: 'asc' },
            });

            return {
                statusCode: 200,
                message: "Pobrano listę sekcji pomyślnie",
                subject,
                sections
            };
        } catch (error) {
            throw new InternalServerErrorException(
                `Nie udało się pobrać sekcji: ${error.message}`
            );
        }
    }

    async deleteTask(
        userId: number,
        subjectId: number,
        id: number
    ) {
        try {
            const subject = await this.prismaService.subject.findUnique({
                where: { id: subjectId },
            });

            if (!subject) throw new BadRequestException('Przedmiot nie został znaleziony');

            const task = await this.prismaService.task.findUnique({
                where: { id, userId },
            });

            if (!task) throw new BadRequestException('Zadanie nie zostało znalezione');

            const topic = await this.prismaService.topic.findUnique({
                where: { id: task.topicId },
            });

            if (!topic) throw new BadRequestException('Temat nie został znaleziony');

            const section = await this.prismaService.section.findUnique({
                where: { id: topic.sectionId },
            });

            if (!section) throw new BadRequestException('Rozdział nie został znaleziony');

            return await this.taskService.deleteTask(
                userId,
                subjectId,
                section.id,
                topic.id,
                id
            );
        }
        catch (error) {
            console.error('Błąd podczas usuwania zadania:', error);
            throw new InternalServerErrorException('Nie udało się usunąć zadanie');
        }
    }

    async findLiteratures(
        id: number,
        startPosition: number
    ) {
        try {
            const subject = await this.prismaService.subject.findUnique({
                where: { id },
            });

            if (!subject) throw new BadRequestException('Przedmiot nie został znaleziony');

            const result = await this.prismaService.$queryRaw<
                { num: number; literature: string }[]
            >`
                SELECT 
                    ROW_NUMBER() OVER (ORDER BY literature ASC) AS num,
                    literature
                FROM (
                    SELECT DISTINCT TRIM(lit) AS literature
                    FROM "Topic",
                        unnest(string_to_array("Topic"."literature", E'\n')) AS lit
                    WHERE "Topic"."subjectId" = ${id}
                    AND lit IS NOT NULL
                    AND TRIM(lit) <> ''
                    AND NOT (TRIM(lit) LIKE '\[%' AND TRIM(lit) LIKE '%\]%')
                ) t
                ORDER BY literature ASC;
            `;

            if (!startPosition || startPosition < 1) {
                return {
                    statusCode: 200,
                    message: "Pobrano literaturę pomyślnie",
                    literatures: result.map(r => r.literature),
                    totalCount: result.length,
                    startPosition: 1
                };
            }

            const filteredLiteratures = result
                .filter(item => item.num >= startPosition)
                .map(item => item.literature);

            return {
                statusCode: 200,
                message: "Pobrano literaturę pomyślnie",
                literatures: filteredLiteratures,
                totalCount: result.length,
                startPosition: startPosition
            };
        }
        catch (error) {
            console.error('Error in findLiteratures:', error);
            throw new InternalServerErrorException('Nie udało się pobrać literaturę');
        }
    }

    async updateLiteratureByName(
        id: number,
        data: LiteratureUpdateRequest
    ) {
        try {
            const subject = await this.prismaService.subject.findUnique({
                where: { id },
            });

            if (!subject) {
                throw new BadRequestException('Przedmiot nie został znaleziony');
            }

            await this.prismaService.literature.upsert({
                where: {
                    subjectId_name: {
                        subjectId: id,
                        name: data.name,
                    },
                },
                update: {
                    note: data.note ?? "",
                },
                create: {
                    subjectId: id,
                    name: data.name,
                    note: data.note ?? "",
                },
            });

            return {
                statusCode: 200,
                message: "Aktualizacja literatury pomyślnie",
            };
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error;
            }

            throw new InternalServerErrorException(
                'Nie udało się zaktualizować literatury'
            );
        }
    }

    async findLiteratureByName(
        id: number,
        name: string
    ) {
        try {
            const subject = await this.prismaService.subject.findUnique({
                where: { id },
            });

            if (!subject) {
                throw new BadRequestException('Przedmiot nie został znaleziony');
            }

            const literature = await this.prismaService.literature.findUnique({
                where: {
                    subjectId_name: {
                        subjectId: id,
                        name: name,
                    },
                },
            });

            return {
                statusCode: 200,
                message: "Pobranie literatury pomyślnie",
                literature
            };
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error;
            }

            throw new InternalServerErrorException(
                'Nie udało się zaktualizować literatury'
            );
        }
    }

    async literatureAIGenerate(
        id: number,
        data: LiteratureAIGenerate,
        signal?: AbortSignal
    ) {
        const url = `${this.fastapiUrl}/admin/literature-generate`;

        try {
            const subject = await this.prismaService.subject.findUnique({
                where: { id },
            });

            if (!subject) {
                throw new BadRequestException('Przedmiot nie został znaleziony');
            }

            if (!Array.isArray(data.errors) || !data.errors.every(item => typeof item === 'string')) {
                throw new BadRequestException('Errors musi być listą stringów');
            }

            const response$ = this.httpService.post(url, data, { signal });
            const response = await firstValueFrom(response$);
            const r = response.data;
            data.prompt = data.prompt ?? subject.literaturePrompt;

            if (
                typeof r.prompt !== 'string' ||
                typeof r.changed !== 'string' ||
                typeof r.name !== 'string' ||
                typeof r.note !== 'string' ||
                !Array.isArray(r.errors) ||
                typeof r.attempt !== 'number'
            ) {
                throw new BadRequestException('Niepoprawna struktura odpowiedzi z serwera.');
            }

            return {
                statusCode: 201,
                message: "Generacja literatury udane",
                ...r,
            };
        } catch (error) {
            if (error.response && error.response.data) {
                const fastApiErrorMessage = error.response.data.detail || JSON.stringify(error.response.data);
                throw new HttpException(`Błąd API: ${fastApiErrorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
            }
            throw new InternalServerErrorException(`Błąd serwisu generującego: ${error.message || error.toString()}`);
        }
    }

    async getDailyProgressTable(userId: number, subjectId: number): Promise<Array<{
        date: string;
        dayOfWeek: string;
        deltaPercent: number;
        timeSpentMinutes: number;
        plannedMinutes: number;
        cumulativeDeltaDays: number;
    }>> {
        const userSubject = await this.prismaService.userSubject.findUnique({
            where: { userId_subjectId: { userId, subjectId } },
            select: { dailyStudyMinutes: true }
        });
        
        if (!userSubject) return [];
        
        const dailyPlanMinutes = userSubject.dailyStudyMinutes || 60;
        
        const firstTask = await this.prismaService.task.findFirst({
            where: { userId, subjectId, finished: true },
            orderBy: { createdAt: 'asc' },
            select: { createdAt: true }
        });
        
        if (!firstTask) return [];
        
        const startDateUTC = new Date(firstTask.createdAt);
        const startDateLocal = this.timezoneService.utcToLocal(startDateUTC);
        startDateLocal.setHours(0, 0, 0, 0);
        
        const todayLocal = this.timezoneService.utcToLocal(new Date());
        todayLocal.setHours(23, 59, 59, 999);
        
        const startDateForQuery = this.timezoneService.localToUTC(startDateLocal);
        const endDateForQuery = this.timezoneService.localToUTC(todayLocal);
        
        const dailyTaskStats = await this.prismaService.$queryRaw<Array<{
            task_date: Date;
            total_seconds: number;
        }>>`
            SELECT 
                DATE(t."updatedAt") as task_date,
                COALESCE(SUM(t."timeSpentSeconds"), 0)::int as total_seconds
            FROM "Task" t
            WHERE t."userId" = ${userId}
                AND t."subjectId" = ${subjectId}
                AND t.finished = true
                AND t."updatedAt" >= ${startDateForQuery}
                AND t."updatedAt" <= ${endDateForQuery}
            GROUP BY DATE(t."updatedAt")
            ORDER BY task_date ASC
        `;
        
        const dailyStatsMap = new Map<string, number>();
        dailyTaskStats.forEach(stat => {
            const utcDate = new Date(stat.task_date);
            const localDate = this.timezoneService.utcToLocal(utcDate);
            const dateStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
            
            const currentValue = dailyStatsMap.get(dateStr) || 0;
            dailyStatsMap.set(dateStr, currentValue + Math.round(stat.total_seconds / 60));
        });
        
        const allDays: Array<{
            date: string;
            dayOfWeek: string;
            deltaPercent: number;
            timeSpentMinutes: number;
            plannedMinutes: number;
            cumulativeDeltaDays: number;
        }> = [];
        
        let cumulativeDeltaMinutes = 0;
        const currentDate = new Date(startDateLocal);
        const dayNames = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];
        
        while (currentDate <= todayLocal) {
            const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
            const actualMinutes = dailyStatsMap.get(dateStr) || 0;
            
            const dailyDeltaMinutes = actualMinutes - dailyPlanMinutes;
            
            const deltaPercent = dailyPlanMinutes > 0 
                ? Math.round((dailyDeltaMinutes / dailyPlanMinutes) * 100) 
                : 0;
            
            cumulativeDeltaMinutes += dailyDeltaMinutes;
            
            const cumulativeDeltaDays = dailyPlanMinutes > 0 
                ? Math.trunc(cumulativeDeltaMinutes / dailyPlanMinutes)
                : 0;
            
            allDays.push({
                date: `${String(currentDate.getDate()).padStart(2, '0')}.${String(currentDate.getMonth() + 1).padStart(2, '0')}.${currentDate.getFullYear()}`,
                dayOfWeek: dayNames[currentDate.getDay()],
                deltaPercent,
                timeSpentMinutes: actualMinutes,
                plannedMinutes: dailyPlanMinutes,
                cumulativeDeltaDays
            });
            
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        return allDays.reverse();
    }

    private mapStatisticRecord(record: any) {
        return {
            remainingDaysToExam: record.remainingDaysToExam,
            examsCount: record.examsCount,
            averageExamScore: record.averageExamScore,
            totalCovered: record.totalCovered,
            predictedScore: record.predictedScore,
            checkedWordsCount: record.checkedWordsCount,
            wordsCoveragePercent: record.wordsCoveragePercent,
            audioTasksCount: record.audioTasksCount,
            averageAudioScore: record.averageAudioScore,
            writingTasksCount: record.writingTasksCount,
            averageWritingScore: record.averageWritingScore
        };
    }

    private async saveAndGetStatisticHistory(
        userId: number,
        subjectId: number,
        params: any
    ) {
        const now = new Date();
        
        const todayUTC = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
            0, 0, 0, 0
        ));

        return await this.prismaService.$transaction(async (tx) => {
            const allRecords = await tx.statistic.findMany({
                where: { userId, subjectId },
                orderBy: [
                    { date: 'desc' },
                    { updatedAt: 'desc' }
                ]
            });

            if (allRecords.length === 0 || allRecords.length === 1) {
                if (allRecords.length === 1) {
                    await tx.statistic.deleteMany({
                        where: { userId, subjectId }
                    });
                }
                
                await tx.statistic.create({
                    data: {
                        userId,
                        subjectId,
                        date: todayUTC,
                        ...params
                    }
                });
                
                await tx.statistic.create({
                    data: {
                        userId,
                        subjectId,
                        date: todayUTC,
                        ...params
                    }
                });
            }
            else if (allRecords.length === 2) {
                const lastRecord = allRecords[0];

                if (lastRecord.date.getTime() === todayUTC.getTime()) {
                    await tx.statistic.update({
                        where: { id: lastRecord.id },
                        data: params
                    });
                } else {
                    await tx.statistic.delete({
                        where: { id: allRecords[1].id }
                    });
                    
                    await tx.statistic.create({
                        data: {
                            userId,
                            subjectId,
                            date: todayUTC,
                            ...params
                        }
                    });
                }
            }

            const lastTwo = await tx.statistic.findMany({
                where: { userId, subjectId },
                orderBy: [
                    { date: 'desc' },
                    { updatedAt: 'desc' }
                ],
                take: 2
            });

            const current = lastTwo[0];
            const previous = lastTwo[1];

            return {
                current: {
                    date: current.date,
                    ...this.mapStatisticRecord(current)
                },
                previous: {
                    date: previous.date,
                    ...this.mapStatisticRecord(previous)
                }
            };
        });
    }

    async getUserStatistic(userId: number, id: number) {
        try {
            const [subject, userSubject] = await Promise.all([
                this.prismaService.subject.findUnique({
                    where: { id },
                    select: { id: true, name: true }
                }),
                this.prismaService.userSubject.findUnique({
                    where: { userId_subjectId: { userId, subjectId: id } },
                    select: {
                        threshold: true,
                        detailLevel: true,
                        dailyStudyMinutes: true,
                        examDate: true
                    }
                })
            ]);

            if (!subject) throw new BadRequestException('Przedmiot nie został znaleziony');
            if (!userSubject) throw new BadRequestException('Użytkownik nie jest zapisany na ten przedmiot');

            const threshold = userSubject.threshold || 50;
            const detailLevel = userSubject.detailLevel || 'BASIC';
            const topicDifficulties = detailLevel === 'EXPANDED' 
                ? ['Podstawowy', 'Rozszerzony'] 
                : ['Podstawowy'];

            const stats = await this.prismaService.$queryRaw<Array<{
                remaining_days: number;
                avg_exam_percent: number;
                exams_count: number;
                coverage_percent: number;
                checked_words: number;
                total_words: number;
                words_coverage: number;
                audio_count: number;
                audio_avg: number;
                writing_count: number;
                writing_avg: number;
            }>>`
                WITH 
                -- Coverage percent (tak jak w findSections)
                coverage_data AS (
                    SELECT
                        CASE WHEN COUNT(*) = 0 THEN 0
                        ELSE 
                            CEIL(
                                COUNT(*) FILTER (WHERE COALESCE(ut.percent, 0) >= ${threshold}) * 100.0 / COUNT(*)
                            )
                            +
                            CEIL(
                                COUNT(*) FILTER (WHERE COALESCE(ut.percent, 0) > 0 AND COALESCE(ut.percent, 0) < ${threshold}) * 100.0 / COUNT(*)
                            )
                        END AS coverage_percent
                    FROM "Topic" t
                    LEFT JOIN "UserTopic" ut 
                        ON ut."topicId" = t.id 
                        AND ut."userId" = ${userId}
                        AND ut."subjectId" = ${id}
                    WHERE t."subjectId" = ${id}
                        AND t."difficulty" = ANY(${topicDifficulties}::text[])
                ),
                -- Exam stats
                exam_data AS (
                    SELECT 
                        COALESCE(AVG(percent), 0)::int AS avg_exam_percent,
                        COUNT(*)::int AS exams_count
                    FROM (
                        SELECT 
                            e.id,
                            COALESCE(
                                (SELECT AVG(t2.percent)::int
                                FROM (
                                    SELECT DISTINCT ON (t2."topicId") t2.percent
                                    FROM "Task" t2
                                    WHERE t2."examId" = e.id
                                        AND t2."userId" = ${userId}
                                    ORDER BY t2."topicId", t2."order" ASC
                                ) t2
                                ), 0
                            ) AS percent
                        FROM "Exam" e
                        WHERE e."userId" = ${userId}
                            AND e."subjectId" = ${id}
                            AND (
                                COALESCE(
                                    (SELECT SUM(t3."timeSpentSeconds")
                                    FROM "Task" t3 
                                    WHERE t3."examId" = e.id AND t3."userId" = ${userId}
                                    ), 0
                                ) >= (SELECT s."totalTimeSpent" * 60 FROM "Subject" s WHERE s.id = ${id})
                                OR (
                                    SELECT COUNT(DISTINCT et."topicId")
                                    FROM "ExamTopic" et WHERE et."examId" = e.id
                                ) = (
                                    SELECT COUNT(DISTINCT t4."topicId")
                                    FROM "Task" t4 
                                    WHERE t4."examId" = e.id 
                                        AND t4."userId" = ${userId} 
                                        AND t4.finished = true
                                )
                            )
                    ) finished_exams
                ),
                -- Word stats
                word_data AS (
                    SELECT 
                        COUNT(*) FILTER (WHERE w."totalAttemptCount" > 0) AS checked_words,
                        COUNT(*) AS total_words,
                        CASE 
                            WHEN COUNT(*) > 0 
                            THEN ROUND((COUNT(*) FILTER (WHERE w."totalAttemptCount" > 0) * 100.0 / COUNT(*))::numeric, 2)
                            ELSE 0 
                        END AS words_coverage
                    FROM "Word" w
                    WHERE w."userId" = ${userId}
                        AND w."subjectId" = ${id}
                ),
                -- Audio stats
                audio_data AS (
                    SELECT 
                        COUNT(*)::int AS audio_count,
                        COALESCE(AVG(t.percent), 0)::int AS audio_avg
                    FROM "Task" t
                    JOIN "Topic" tp ON tp.id = t."topicId"
                    WHERE t."userId" = ${userId}
                        AND t."subjectId" = ${id}
                        AND t.finished = true
                        AND tp.type = 'Stories'
                ),
                -- Writing stats
                writing_data AS (
                    SELECT 
                        COUNT(*)::int AS writing_count,
                        COALESCE(AVG(t.percent), 0)::int AS writing_avg
                    FROM "Task" t
                    JOIN "Topic" tp ON tp.id = t."topicId"
                    WHERE t."userId" = ${userId}
                        AND t."subjectId" = ${id}
                        AND t.finished = true
                        AND tp.type = 'Writing'
                ),
                -- Remaining days
                days_data AS (
                    SELECT 
                        CASE 
                            WHEN ${userSubject.examDate ?? new Date()}::date <= CURRENT_DATE THEN 0
                            ELSE (${userSubject.examDate ?? new Date()}::date - CURRENT_DATE)
                        END AS remaining_days
                )
                SELECT 
                    d.remaining_days,
                    e.avg_exam_percent,
                    e.exams_count,
                    c.coverage_percent,
                    w.checked_words,
                    w.total_words,
                    w.words_coverage,
                    a.audio_count,
                    a.audio_avg,
                    wr.writing_count,
                    wr.writing_avg
                FROM days_data d
                CROSS JOIN exam_data e
                CROSS JOIN coverage_data c
                CROSS JOIN word_data w
                CROSS JOIN audio_data a
                CROSS JOIN writing_data wr
            `;

            const s = stats[0];

            const remainingDays = s?.remaining_days || 0;
            const coveragePercent = s?.coverage_percent || 0;

            const predictedScore = Math.round(
                (s?.avg_exam_percent || 0) * 0.6 + coveragePercent * 0.4
            );

            const dailyProgress = await this.getDailyProgressTableOptimized(
                userId, 
                id, 
                userSubject.dailyStudyMinutes || 60
            );

            const statisticParams = {
                remainingDaysToExam: remainingDays,
                examsCount: s?.exams_count || 0,
                averageExamScore: s?.avg_exam_percent || 0,
                totalCovered: coveragePercent,
                predictedScore,
                checkedWordsCount: Number(s?.checked_words) || 0,
                wordsCoveragePercent: Number(s?.words_coverage) || 0,
                audioTasksCount: s?.audio_count || 0,
                averageAudioScore: s?.audio_avg || 0,
                writingTasksCount: s?.writing_count || 0,
                averageWritingScore: s?.writing_avg || 0
            };

            const statisticHistory = await this.saveAndGetStatisticHistory(
                userId,
                id,
                statisticParams
            );

            return {
                statusCode: 200,
                message: 'Statystyki zostały pomyślnie pobrane',
                statistic: {
                    current: statisticHistory.current,
                    previous: statisticHistory.previous,
                    dailyProgress
                }
            };
        } catch (error) {
            console.error('Error in getUserStatistic:', error);
            if (error instanceof BadRequestException) throw error;
            throw new InternalServerErrorException('Nie udało się pobrać statystyki');
        }
    }

    private async getDailyProgressTableOptimized(
        userId: number,
        subjectId: number,
        dailyPlanMinutes: number
    ): Promise<Array<{
        date: string;
        dayOfWeek: string;
        deltaPercent: number;
        timeSpentMinutes: number;
        plannedMinutes: number;
        skipped: boolean;
    }>> {
        const taskData = await this.prismaService.$queryRaw<Array<{
            taskId: number;
            taskDate: Date;
            topicType: string;
            topicId: number; 
            subtopicId: number | null;
            subtopicPercent: number | null;
            taskPercent: number | null;
            importance: number | null;
            detailLevel: string | null;
            timeSpentSeconds: number;
        }>>`
            WITH task_with_progress AS (
                SELECT 
                    t.id AS "taskId",
                    DATE(t."updatedAt") AS "taskDate",
                    t."timeSpentSeconds",
                    t.percent AS "taskPercent",
                    t."topicId",
                    tp.type AS "topicType",
                    sp."subtopicId",
                    sp.percent AS "subtopicPercent",
                    s.importance,
                    s."detailLevel"
                FROM "Task" t
                JOIN "Topic" tp ON tp.id = t."topicId"
                LEFT JOIN "SubtopicProgress" sp ON sp."taskId" = t.id
                LEFT JOIN "Subtopic" s ON s.id = sp."subtopicId"
                WHERE t."userId" = ${userId}
                    AND t."subjectId" = ${subjectId}
                    AND t.finished = true
            )
            SELECT 
                twp."taskId",
                twp."taskDate",
                twp."timeSpentSeconds",
                twp."taskPercent",
                twp."topicType",
                twp."topicId",
                twp."subtopicId",
                twp."subtopicPercent",
                twp.importance,
                twp."detailLevel"
            FROM task_with_progress twp
            ORDER BY twp."taskDate" ASC
        `;

        if (taskData.length === 0) return [];

        const dailyTasksMap = new Map<string, Array<{
            taskId: number;
            topicType: string;
            topicId: number;
            subtopicId: number | null;
            subtopicPercent: number | null;
            taskPercent: number | null;
            importance: number | null;
            detailLevel: string | null;
            timeSpentSeconds: number;
        }>>();

        for (const task of taskData) {
            const dateKey = task.taskDate.toISOString().split('T')[0];
            if (!dailyTasksMap.has(dateKey)) {
                dailyTasksMap.set(dateKey, []);
            }
            dailyTasksMap.get(dateKey)!.push({
                taskId: task.taskId,
                topicId: task.topicId,
                topicType: task.topicType,
                subtopicId: task.subtopicId,
                subtopicPercent: task.subtopicPercent,
                importance: task.importance,
                taskPercent: task.taskPercent,
                detailLevel: task.detailLevel,
                timeSpentSeconds: task.timeSpentSeconds
            });
        }

        const firstDateKey = taskData[0].taskDate.toISOString().split('T')[0];
        const firstDate = new Date(firstDateKey + 'T00:00:00.000Z');

        const todayKey = new Date().toISOString().split('T')[0];
        const lastDate = new Date(todayKey + 'T00:00:00.000Z');

        const allDateKeys: string[] = [];
        const cursor = new Date(firstDate);
        while (cursor <= lastDate) {
            allDateKeys.push(cursor.toISOString().split('T')[0]);
            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }

        const result: Array<any> = [];
        const dayNames = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];

        for (const dateKey of allDateKeys) {
            const tasks = dailyTasksMap.get(dateKey) ?? [];
            let totalDailySeconds = 0;

            for (const task of tasks) {
                let timeSeconds = 0;

                if (task.topicType === 'Writing') {
                    let percent = 0;
                    if (task.subtopicId !== null && task.subtopicPercent !== null) {
                        percent = task.subtopicPercent;
                    } else if (task.taskPercent !== null) {
                        percent = task.taskPercent;
                    }
                    timeSeconds = 3600 * (percent / 100);
                }
                else if (task.topicType === 'Stories') {
                    // Базовая стоимость слов, прикреплённых именно к этой задаче
                    const baseTimeTotal = await this.getBaseTimeForTaskWords(task.taskId);

                    // Масштабируем по проценту выполнения ЭТОЙ задачи —
                    // та же логика, что и в ветке Writing/Subtopic (percent/100, без инверсии)
                    const percent = task.taskPercent ?? 0;
                    timeSeconds = baseTimeTotal * (percent / 100);
                }
                else if (task.subtopicId !== null && task.subtopicPercent !== null) {
                    const importance = task.importance ?? 100;
                    const percent = task.subtopicPercent;
                    const detailLevel = task.detailLevel as SubjectDetailLevel || 'BASIC';

                    let baseTimeSeconds = 0;
                    if (detailLevel === SubjectDetailLevel.BASIC) {
                        baseTimeSeconds = (10 + 10 * (importance / 100)) * 60;
                    } else if (detailLevel === SubjectDetailLevel.EXPANDED) {
                        baseTimeSeconds = (12 + 13 * (importance / 100)) * 60;
                    } else {
                        baseTimeSeconds = 600;
                    }

                    timeSeconds = baseTimeSeconds * (percent / 100);
                }
                else {
                    timeSeconds = task.timeSpentSeconds;
                }

                totalDailySeconds += timeSeconds;
            }

            const actualMinutes = tasks.length > 0 ? Math.ceil(totalDailySeconds / 60) : 0;
            const deltaMinutes = actualMinutes - dailyPlanMinutes;

            const dateObj = new Date(dateKey + 'T00:00:00.000Z');
            const dateStr = `${String(dateObj.getUTCDate()).padStart(2, '0')}.${String(dateObj.getUTCMonth() + 1).padStart(2, '0')}.${dateObj.getUTCFullYear()}`;

            result.push({
                date: dateStr,
                dayOfWeek: dayNames[dateObj.getUTCDay()],
                deltaPercent: dailyPlanMinutes > 0 ? Math.round((deltaMinutes / dailyPlanMinutes) * 100) : 0,
                timeSpentMinutes: actualMinutes,
                plannedMinutes: dailyPlanMinutes,
                skipped: tasks.length === 0
            });
        }

        return result.reverse();
    }

    private async getBaseTimeForTaskWords(taskId: number): Promise<number> {
        const words = await this.prismaService.$queryRaw<Array<{ frequency: number | null }>>`
            SELECT w.frequency
            FROM "TaskWord" tw
            JOIN "Word" w ON w.id = tw."wordId"
            WHERE tw."taskId" = ${taskId}
        `;

        return words.reduce((sum, w) => {
            const importance = 100 - (w.frequency ?? 0);
            const perWordTime = (2 + 2 * (importance / 100)) * 60;
            return sum + perWordTime;
        }, 0);
    }
}