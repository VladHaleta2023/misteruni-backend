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

    private async getRemainingDaysToExam(userId: number, subjectId: number): Promise<number> {
        const userSubject = await this.prismaService.userSubject.findUnique({
            where: { userId_subjectId: { userId, subjectId } },
            select: { examDate: true }
        });
        
        if (!userSubject?.examDate) return 0;
        
        const now = new Date();
        const examDate = new Date(userSubject.examDate);
        const diffTime = examDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return Math.max(0, diffDays);
    }

    private async getExamStats(userId: number, subjectId: number): Promise<{
        averagePercent: number;
        examsCount: number;
    }> {
        const result = await this.prismaService.$queryRaw<Array<{
            avg_percent: number;
            exams_count: number;
        }>>`
            SELECT 
                COALESCE(AVG(percent), 0)::int as avg_percent,
                COUNT(*)::int as exams_count
            FROM (
                SELECT 
                    e.id,
                    COALESCE(
                        (SELECT AVG(t.percent)::int
                        FROM (
                            SELECT DISTINCT ON (t."topicId") t.percent
                            FROM "Task" t
                            WHERE t."examId" = e.id
                            AND t."userId" = ${userId}
                            ORDER BY t."topicId", t."order" ASC
                        ) t
                        ), 0
                    ) as percent
                FROM "Exam" e
                WHERE e."userId" = ${userId}
                AND e."subjectId" = ${subjectId}
                AND (
                    -- Экзамен завершен по времени
                    COALESCE(
                        (SELECT SUM(t."timeSpentSeconds")
                        FROM "Task" t WHERE t."examId" = e.id AND t."userId" = ${userId}
                        ), 0
                    ) >= (SELECT s."totalTimeSpent" * 60 FROM "Subject" s WHERE s.id = ${subjectId})
                    -- Или все темы пройдены
                    OR (
                        SELECT COUNT(DISTINCT et."topicId")
                        FROM "ExamTopic" et WHERE et."examId" = e.id
                    ) = (
                        SELECT COUNT(DISTINCT t."topicId")
                        FROM "Task" t WHERE t."examId" = e.id AND t."userId" = ${userId} AND t.finished = true
                    )
                )
            ) finished_exams
        `;
        
        return {
            averagePercent: result[0]?.avg_percent || 0,
            examsCount: result[0]?.exams_count || 0
        };
    }

    private async getTotalVerificationPercent(userId: number, subjectId: number): Promise<{
        completed: number;
        progress: number;
        started: number;
        willNotFinish: number;
        totalCovered: number;
    }> {
        const result = await this.prismaService.$queryRaw<Array<{
            status: string;
            count: number;
        }>>`
            SELECT 
                CASE 
                    WHEN us.percent >= us2.threshold THEN 'completed'
                    WHEN us.percent > 0 THEN 'progress'
                    ELSE 'started'
                END as status,
                COUNT(*)::int as count
            FROM "UserSection" us
            JOIN "UserSubject" us2 ON us2."userId" = us."userId" 
                AND us2."subjectId" = us."subjectId"
            WHERE us."userId" = ${userId}
                AND us."subjectId" = ${subjectId}
            GROUP BY 
                CASE 
                    WHEN us.percent >= us2.threshold THEN 'completed'
                    WHEN us.percent > 0 THEN 'progress'
                    ELSE 'started'
                END
        `;
        
        const completed = result.find(r => r.status === 'completed')?.count || 0;
        const progress = result.find(r => r.status === 'progress')?.count || 0;
        const started = result.find(r => r.status === 'started')?.count || 0;
        const total = completed + progress + started;
        
        const userSubject = await this.prismaService.userSubject.findUnique({
            where: { userId_subjectId: { userId, subjectId } },
            select: { examDate: true }
        });
        
        let willNotFinish = 0;
        if (userSubject?.examDate && total > 0) {
            const now = new Date();
            const examDate = new Date(userSubject.examDate);
            const daysToExam = Math.ceil((examDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysToExam <= 0) {
                willNotFinish = Math.ceil((started / total) * 100);
            }
        }
        
        return {
            completed: total > 0 ? Math.ceil((completed / total) * 100) : 0,
            progress: total > 0 ? Math.ceil((progress / total) * 100) : 0,
            started: total > 0 ? Math.ceil((started / total) * 100) : 0,
            willNotFinish,
            totalCovered: total > 0 ? Math.ceil(((completed + progress) / total) * 100) : 0
        };
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

    private async getWordStats(userId: number, subjectId: number): Promise<{
        checkedWordsCount: number;
        totalWordsCount: number;
        coveragePercent: number;
    }> {
        const allWords = await this.prismaService.word.findMany({
            where: { userId, subjectId },
            select: { totalAttemptCount: true }
        });

        const totalCount = allWords.length;
        const checkedCount = allWords.filter(w => (w.totalAttemptCount ?? 0) > 0).length;
        
        const coveragePercent = totalCount > 0 
            ? parseFloat(((checkedCount / totalCount) * 100).toFixed(2))
            : 0;

        return {
            checkedWordsCount: checkedCount,
            totalWordsCount: totalCount,
            coveragePercent
        };
    }

    private async getAudioTaskStats(userId: number, subjectId: number): Promise<{
        audioTasksCount: number;
        averageAudioScore: number;
    }> {
        const result = await this.prismaService.$queryRaw<Array<{
            count: number;
            avg_percent: number;
        }>>`
            SELECT 
                COUNT(*)::int as count,
                COALESCE(AVG(t.percent), 0)::int as avg_percent
            FROM "Task" t
            JOIN "Topic" tp ON tp.id = t."topicId"
            WHERE t."userId" = ${userId}
                AND t."subjectId" = ${subjectId}
                AND t.finished = true
                AND tp.type = 'Stories'
        `;

        return {
            audioTasksCount: result[0]?.count || 0,
            averageAudioScore: result[0]?.avg_percent || 0
        };
    }

    private async getWritingTaskStats(userId: number, subjectId: number): Promise<{
        writingTasksCount: number;
        averageWritingScore: number;
    }> {
        const result = await this.prismaService.$queryRaw<Array<{
            count: number;
            avg_percent: number;
        }>>`
            SELECT 
                COUNT(*)::int as count,
                COALESCE(AVG(t.percent), 0)::int as avg_percent
            FROM "Task" t
            JOIN "Topic" tp ON tp.id = t."topicId"
            WHERE t."userId" = ${userId}
                AND t."subjectId" = ${subjectId}
                AND t.finished = true
                AND tp.type = 'Writing'
        `;

        return {
            writingTasksCount: result[0]?.count || 0,
            averageWritingScore: result[0]?.avg_percent || 0
        };
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
                orderBy: { date: 'desc' }
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
                orderBy: { date: 'desc' },
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

            const [
                remainingDays,
                examStats,
                verificationPercent,
                dailyProgress,
                wordStats,
                audioTaskStats,
                writingTaskStats,
            ] = await Promise.all([
                this.getRemainingDaysToExam(userId, id),
                this.getExamStats(userId, id),
                this.getTotalVerificationPercent(userId, id),
                this.getDailyProgressTable(userId, id),
                this.getWordStats(userId, id),
                this.getAudioTaskStats(userId, id),
                this.getWritingTaskStats(userId, id),
            ]);

            const predictedScore = Math.round(
                examStats.averagePercent * 0.6 + verificationPercent.totalCovered * 0.4
            );

            const statisticParams = {
                remainingDaysToExam: remainingDays,
                examsCount: examStats.examsCount,
                averageExamScore: examStats.averagePercent,
                totalCovered: verificationPercent.totalCovered,
                predictedScore: predictedScore,
                checkedWordsCount: wordStats.checkedWordsCount,
                wordsCoveragePercent: wordStats.coveragePercent,
                audioTasksCount: audioTaskStats.audioTasksCount,
                averageAudioScore: audioTaskStats.averageAudioScore,
                writingTasksCount: writingTaskStats.writingTasksCount,
                averageWritingScore: writingTaskStats.averageWritingScore
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
                    dailyProgress: dailyProgress
                }
            };
        } catch (error) {
            console.error('Error in getUserStatistic:', error);
            if (error instanceof BadRequestException) throw error;
            throw new InternalServerErrorException('Nie udało się pobrać statystyki');
        }
    }
}