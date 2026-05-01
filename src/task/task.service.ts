import { HttpService } from '@nestjs/axios';
import { BadRequestException, HttpException, HttpStatus, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatAIGenerate, InteractiveTaskAIGenerate, OptionsAIGenerate, ProblemsAIGenerate, SolutionGuideAIGenerate, TaskAIGenerate, VocabluaryAIGenerate, WritingAIGenerate } from './dto/task-generate.dto';
import { firstValueFrom } from 'rxjs';
import { SubtopicService } from '../subtopic/subtopic.service';
import { SolutionGuideRequest, SubtopicsProgressUpdateRequest, TaskCreateRequest, TaskUpdateChatRequest, TaskUpdateRequest, TaskUserSolutionRequest } from './dto/task-request.dto';
import { OptionsService } from '../options/options.service';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../storage/storage.service';
import { Prisma, SubjectDetailLevel } from '@prisma/client';

type Status = 'blocked' | 'started' | 'progress' | 'completed';

@Injectable()
export class TaskService {
    private readonly fastapiUrl: string | undefined;

    constructor(
        private readonly prismaService: PrismaService,
        private readonly subtopicService: SubtopicService,
        private readonly httpService: HttpService,
        private readonly storageService: StorageService,
        private readonly optionsService: OptionsService,
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

    private getPrompt = (...prompts: (string | null | undefined)[]): string | null => {
        for (const prompt of prompts) {
            if (prompt && prompt.trim() !== '') {
                return prompt;
            }
        }
        return null;
    };

    private async syncUserProgressTables(userId: number, subjectId: number, tx: Prisma.TransactionClient) {
        await tx.$executeRaw`
            INSERT INTO "UserSection" ("userId", "subjectId", "sectionId", "percent", "createdAt", "updatedAt")
            SELECT ${userId}, ${subjectId}, s.id, 0, NOW(), NOW()
            FROM "Section" s
            LEFT JOIN "UserSection" us ON us."sectionId" = s.id 
                AND us."userId" = ${userId}
                AND us."subjectId" = ${subjectId}
            WHERE us."sectionId" IS NULL 
                AND s."subjectId" = ${subjectId};
        `;

        await tx.$executeRaw`
            INSERT INTO "UserTopic" ("userId", "subjectId", "topicId", "sectionId", "percent", "createdAt", "updatedAt")
            SELECT ${userId}, ${subjectId}, t.id, t."sectionId", 0, NOW(), NOW()
            FROM "Topic" t
            LEFT JOIN "UserTopic" ut ON ut."topicId" = t.id 
                AND ut."userId" = ${userId}
                AND ut."subjectId" = ${subjectId}
            WHERE ut."topicId" IS NULL 
                AND t."subjectId" = ${subjectId};
        `;

        await tx.$executeRaw`
            INSERT INTO "UserSubtopic" ("userId", "subjectId", "sectionId", "topicId", "subtopicId", "percent", "createdAt", "updatedAt")
            SELECT ${userId}, ${subjectId}, st."sectionId", st."topicId", st.id, 0, NOW(), NOW()
            FROM "Subtopic" st
            LEFT JOIN "UserSubtopic" ust ON ust."subtopicId" = st.id 
                AND ust."userId" = ${userId}
                AND ust."subjectId" = ${subjectId}
            WHERE ust."subtopicId" IS NULL 
                AND st."subjectId" = ${subjectId};
        `;
    }

    async findTasks(userId: number, subjectId: number, sectionId: number, topicId: number) {
        try {
            const result = await this.prismaService.$queryRaw<any[]>`
                WITH 
                threshold_val AS (
                    SELECT COALESCE(threshold, 50) as val
                    FROM "UserSubject"
                    WHERE "userId" = ${userId} AND "subjectId" = ${subjectId}
                ),
                topic_literature AS (
                    SELECT 
                        ${topicId} as "topicId",
                        COALESCE(
                            ARRAY_AGG(
                                DISTINCT TRIM(lit)
                                ORDER BY TRIM(lit)
                            ) FILTER (
                                WHERE lit IS NOT NULL 
                                AND TRIM(lit) <> ''
                                AND NOT (TRIM(lit) LIKE '[%' AND TRIM(lit) LIKE '%]%')
                            ),
                            ARRAY[]::text[]
                        ) as literatures
                    FROM unnest(
                        string_to_array((SELECT literature FROM "Topic" WHERE id = ${topicId}), E'\n')
                    ) as lit
                ),
                data AS (
                    SELECT 
                        -- Тема
                        t.id as "topicId",
                        t.name as "topicName",
                        t.note as "topicNote",
                        t."partId" as "topicPartId",
                        t.frequency as "topicFrequency",
                        tl.literatures as "topicLiteratures",
                        COALESCE(ut.percent, 0) as "topicPercent",
                        CASE 
                            WHEN COALESCE(ut.percent, 0) >= (SELECT val FROM threshold_val) THEN 'completed'
                            WHEN COALESCE(ut.percent, 0) > 0 THEN 'progress'
                            ELSE 'started'
                        END as "topicStatus",
                        
                        -- Задачи (сгруппированные по дате)
                        COALESCE(
                            (SELECT json_object_agg(
                                task_date, 
                                task_array
                            )
                            FROM (
                                SELECT 
                                    DATE(tk."updatedAt") as task_date,
                                    json_agg(
                                        json_build_object(
                                            'id', tk.id,
                                            'text', tk.text,
                                            'percent', tk.percent,
                                            'explanation', COALESCE(tk.explanation, ''),
                                            'userSolution', COALESCE(tk."userSolution", ''),
                                            'finished', tk.finished,
                                            'status', CASE 
                                                WHEN tk.percent = 0 THEN 'started'
                                                WHEN tk.percent < (SELECT val FROM threshold_val) THEN 'progress'
                                                ELSE 'completed'
                                            END
                                        ) ORDER BY tk."updatedAt" DESC
                                    ) as task_array
                                FROM "Task" tk
                                WHERE tk."userId" = ${userId} 
                                    AND tk."topicId" = ${topicId}
                                GROUP BY DATE(tk."updatedAt")
                            ) grouped_tasks
                            ),
                            '{}'::json
                        ) as tasks_by_date
                        
                    FROM "Topic" t
                    CROSS JOIN topic_literature tl
                    LEFT JOIN "UserTopic" ut ON ut."userId" = ${userId} 
                        AND ut."subjectId" = ${subjectId}
                        AND ut."topicId" = t.id
                    WHERE t.id = ${topicId}
                )
                SELECT * FROM data
            `;

            if (result.length === 0 || !result[0].topicId) {
                throw new BadRequestException('Temat nie został znaleziony');
            }

            const row = result[0];
            const topic = {
                id: row.topicId,
                name: row.topicName,
                note: row.topicNote,
                partId: row.topicPartId,
                frequency: row.topicFrequency,
                percent: row.topicPercent,
                status: row.topicStatus as Status,
                literatures: row.topicLiteratures || []
            };

            const elements: any[] = [];
            const tasksByDate = row.tasks_by_date || {};
            
            Object.entries(tasksByDate)
                .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
                .forEach(([dateStr, tasks]: [string, any]) => {
                    const date = new Date(dateStr);
                    const day = String(date.getDate()).padStart(2, '0');
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const year = String(date.getFullYear());
                    
                    elements.push({
                        date: { day, month, year },
                        tasks: tasks.map((task: any) => ({
                            id: task.id,
                            text: task.text,
                            percent: task.percent,
                            explanation: task.explanation,
                            userSolution: task.userSolution,
                            finished: task.finished,
                            status: task.status as Status
                        }))
                    });
                });

            return {
                statusCode: 200,
                message: 'Pobrano listę zadań pomyślnie',
                elements,
                topic,
                prediction: null,
            };
        } catch (error) {
            console.error('Error in findTasks:', error);
            throw new InternalServerErrorException(
                `Nie udało się pobrać listy zadań: ${error.message || error}`
            );
        }
    }

    async findTaskById(
        userId: number,
        subjectId: number,
        sectionId: number,
        topicId: number,
        id: number
    ) {
        try {
            const userSubject = await this.prismaService.userSubject.findUnique({
                where: {
                    userId_subjectId: { userId, subjectId }
                },
                select: { threshold: true }
            });

            const threshold = userSubject?.threshold ?? 50;

            const task = await this.prismaService.$queryRaw<any[]>`
                WITH task_main AS (
                    SELECT
                        t.*,
                        tp.note AS "topicNote",
                        tp.name AS "topicName",
                        tp."literature" AS "topicLiterature"
                    FROM "Task" t
                    JOIN "Topic" tp ON tp.id = t."topicId"
                    WHERE
                        t."userId" = ${userId}
                        AND t.id = ${id}
                ),

                words_detailed AS (
                    SELECT 
                        tw."taskId",
                        w.id,
                        w.text,
                        w."totalAttemptCount",
                        w."totalCorrectCount",
                        CASE
                            WHEN w."totalAttemptCount" = 0 THEN 0
                            ELSE LEAST(
                                100,
                                CEIL(w."totalCorrectCount" * 100.0 / w."totalAttemptCount")
                            )
                        END AS percent
                    FROM "TaskWord" tw
                    JOIN "Word" w ON w.id = tw."wordId"
                ),

                words_agg AS (
                    SELECT 
                        wd."taskId",
                        json_agg(
                            jsonb_build_object(
                                'id', wd.id,
                                'text', wd.text,
                                'totalAttemptCount', wd."totalAttemptCount",
                                'totalCorrectCount', wd."totalCorrectCount",
                                'percent', wd.percent
                            )
                        ) AS words,
                        BOOL_AND(wd.percent >= ${threshold}) AS "wordsCompleted"
                    FROM words_detailed wd
                    GROUP BY wd."taskId"
                ),

                subtopics_agg AS (
                    SELECT 
                        sp."taskId",
                        json_agg(
                            jsonb_build_object(
                                'name', s.name,
                                'percent', sp.percent
                            )
                        ) AS subtopics
                    FROM "SubtopicProgress" sp
                    JOIN "Subtopic" s ON s.id = sp."subtopicId"
                    GROUP BY sp."taskId"
                ),

                audio_agg AS (
                    SELECT 
                        "taskId",
                        json_agg(url) AS "audioFiles"
                    FROM "AudioFile"
                    GROUP BY "taskId"
                )

                SELECT
                    t.*,
                    COALESCE(
                        (
                            SELECT json_agg(clean_line)
                            FROM (
                                SELECT TRIM(line) AS clean_line
                                FROM unnest(
                                    string_to_array(
                                        COALESCE(t."topicLiterature", ''),
                                        E'\n'
                                    )
                                ) AS line
                                WHERE line NOT LIKE '%[%]%'
                                AND TRIM(line) <> ''
                            ) filtered
                        ),
                        '[]'
                    ) AS literatures,

                    COALESCE(wa.words, '[]') AS words,
                    COALESCE(wa."wordsCompleted", false) AS "wordsCompleted",
                    COALESCE(sta.subtopics, '[]') AS subtopics,
                    COALESCE(aa."audioFiles", '[]') AS "audioFiles",
                    CASE
                        WHEN COALESCE(t.percent, 0) = 0 THEN 'started'
                        WHEN COALESCE(t.percent, 0) < ${threshold} THEN 'progress'
                        ELSE 'completed'
                    END AS "status"

                FROM task_main t
                LEFT JOIN words_agg wa ON wa."taskId" = t.id
                LEFT JOIN subtopics_agg sta ON sta."taskId" = t.id
                LEFT JOIN audio_agg aa ON aa."taskId" = t.id
            `;

            return {
                statusCode: 200,
                message: 'Pobrano zadanie pomyślnie',
                task: task[0] || null
            };

        } catch (error: any) {
            console.error('SQL Error in findTaskById:', error);
            throw new InternalServerErrorException(`Błąd SQL: ${error.message}`);
        }
    }

    async updateChatTaskById(
        userId: number,
        subjectId: number,
        sectionId: number,
        topicId: number,
        id: number,
        data: TaskUpdateChatRequest
    ) {
        try {
            const subject = await this.prismaService.subject.findUnique({
                where: { id: subjectId },
            });

            if (!subject) throw new BadRequestException('Przedmiot nie został znaleziony');

            const section = await this.prismaService.section.findUnique({
                where: { id: sectionId },
            });

            if (!section) throw new BadRequestException('Dział nie został znaleziony');

            const topic = await this.prismaService.topic.findUnique({
                where: { id: topicId },
            });

            if (!topic) throw new BadRequestException('Temat nie został znaleziony');

            await this.prismaService.task.update({
                where: {
                    id,
                    userId
                },
                data
            });

            return {
                statusCode: 200,
                message: 'Aktualizacja czatu zadania pomyślnie',
            }
        } catch (error) {
            throw new InternalServerErrorException('Nie udało się pobrać ostatniego zakończonego zadania');
        }
    }

    async findPendingTask(
        userId: number,
        subjectId: number,
        sectionId: number,
        topicId: number,
    ) {
        try {
            const userSubject = await this.prismaService.userSubject.findUnique({
                where: {
                    userId_subjectId: { userId, subjectId },
                },
                select: { threshold: true },
            });

            const threshold = userSubject?.threshold ?? 50;

            const task = await this.prismaService.$queryRaw<any[]>`
                WITH task_main AS (
                    SELECT
                        t.*,
                        tp.note AS "topicNote",
                        tp.name AS "topicName",
                        tp."literature" AS "topicLiterature"
                    FROM "Task" t
                    JOIN "Topic" tp ON tp.id = t."topicId"
                    WHERE
                        t."userId" = ${userId}
                        AND t."topicId" = ${topicId}
                        AND t."finished" = false
                    ORDER BY t."order" ASC
                    LIMIT 1
                ),

                words_detailed AS (
                    SELECT 
                        tw."taskId",
                        w.id,
                        w.text,
                        w."totalAttemptCount",
                        w."totalCorrectCount",
                        CASE
                            WHEN w."totalAttemptCount" = 0 THEN 0
                            ELSE LEAST(
                                100,
                                CEIL(w."totalCorrectCount" * 100.0 / w."totalAttemptCount")
                            )
                        END AS percent
                    FROM "TaskWord" tw
                    JOIN "Word" w ON w.id = tw."wordId"
                ),

                words_agg AS (
                    SELECT 
                        wd."taskId",
                        json_agg(
                            jsonb_build_object(
                                'id', wd.id,
                                'text', wd.text,
                                'totalAttemptCount', wd."totalAttemptCount",
                                'totalCorrectCount', wd."totalCorrectCount",
                                'percent', wd.percent
                            )
                        ) AS words,
                        BOOL_AND(wd.percent >= ${threshold}) AS "wordsCompleted"
                    FROM words_detailed wd
                    GROUP BY wd."taskId"
                ),

                subtopics_agg AS (
                    SELECT 
                        sp."taskId",
                        json_agg(
                            jsonb_build_object(
                                'name', s.name,
                                'percent', sp.percent
                            )
                        ) AS subtopics
                    FROM "SubtopicProgress" sp
                    JOIN "Subtopic" s ON s.id = sp."subtopicId"
                    GROUP BY sp."taskId"
                ),

                audio_agg AS (
                    SELECT 
                        "taskId",
                        json_agg(url) AS "audioFiles"
                    FROM "AudioFile"
                    GROUP BY "taskId"
                )

                SELECT 
                    t.*,
                    COALESCE(
                        (
                            SELECT json_agg(clean_line)
                            FROM (
                                SELECT TRIM(line) AS clean_line
                                FROM unnest(
                                    string_to_array(
                                        COALESCE(t."topicLiterature", ''),
                                        E'\n'
                                    )
                                ) AS line
                                WHERE line NOT LIKE '%[%]%'
                                AND TRIM(line) <> ''
                            ) filtered
                        ),
                        '[]'
                    ) AS literatures,

                    COALESCE(wa.words, '[]') AS words,
                    COALESCE(wa."wordsCompleted", false) AS "wordsCompleted",
                    COALESCE(sta.subtopics, '[]') AS subtopics,
                    COALESCE(aa."audioFiles", '[]') AS "audioFiles",
                    CASE
                        WHEN COALESCE(t.percent, 0) = 0 THEN 'started'
                        WHEN COALESCE(t.percent, 0) < ${threshold} THEN 'progress'
                        ELSE 'completed'
                    END AS "status"

                FROM task_main t
                LEFT JOIN words_agg wa ON wa."taskId" = t.id
                LEFT JOIN subtopics_agg sta ON sta."taskId" = t.id
                LEFT JOIN audio_agg aa ON aa."taskId" = t.id
            `;

            if (!task[0]) {
                return {
                    statusCode: 200,
                    message: 'Brak zadań do pobrania',
                    task: null,
                };
            }

            return {
                statusCode: 200,
                message: 'Pobrano ostatnie zadanie pomyślnie',
                task: task[0],
            };

        } catch (error: any) {
            console.error('SQL Error in findPendingTask:', error);
            throw new InternalServerErrorException(`Błąd SQL: ${error.message}`);
        }
    }

    async taskAIGenerate(
        userId: number,
        subjectId: number,
        sectionId: number,
        topicId: number,
        data: TaskAIGenerate,
        signal?: AbortSignal
    ) {
        const url = `${this.fastapiUrl}/admin/task-generate`;

        try {
            const [subject, section, topic] = await Promise.all([
                this.prismaService.subject.findUnique({ where: { id: subjectId } }),
                this.prismaService.section.findUnique({ where: { id: sectionId } }),
                this.prismaService.topic.findUnique({ where: { id: topicId } }),
            ]);
            if (!subject) throw new BadRequestException('Przedmiot nie został znaleziony');
            if (!section) throw new BadRequestException('Dział nie został znaleziony');
            if (!topic) throw new BadRequestException('Temat nie został znaleziony');

            const userSubject = await this.prismaService.userSubject.findUnique({
                where: { userId_subjectId: { userId, subjectId } },
                select: { threshold: true, detailLevel: true }
            });

            const threshold = userSubject?.threshold ?? 50;
            const detailLevel = userSubject?.detailLevel ?? 'BASIC';

            const subtopics = await this.prismaService.$queryRaw<any[]>`
                SELECT 
                    st.name,
                    st."partId",
                    COALESCE(ust.percent, 0) AS "percent"
                FROM "Subtopic" st
                LEFT JOIN "UserSubtopic" ust
                    ON ust."subtopicId" = st.id 
                    AND ust."userId" = ${userId}
                    AND ust."subjectId" = ${subjectId}
                WHERE st."topicId" = ${topicId}
                    AND st."sectionId" = ${sectionId}
                    AND st."subjectId" = ${subjectId}
                    AND st."detailLevel"::text = ANY(
                        CASE ${detailLevel}::text
                            WHEN 'ACADEMIC' THEN ARRAY['BASIC', 'EXPANDED', 'ACADEMIC']::text[]
                            WHEN 'EXPANDED' THEN ARRAY['BASIC', 'EXPANDED']::text[]
                            ELSE ARRAY['BASIC']::text[]
                        END
                    )
                ORDER BY 
                    st."partId" ASC
            `;

            const belowThreshold = subtopics.filter(s => s.percent < threshold);
            const finalSubtopics = belowThreshold.length > 0 ? belowThreshold : subtopics;

            const formattedSubtopics = finalSubtopics.slice(0, 5).map(s => s.name);

            data.subtopics = data.subtopics ?? formattedSubtopics;
            data.subject = data.subject ?? subject.name;
            data.information = data.information ?? topic.information;
            data.accounts = data.accounts ?? subject.accounts;
            data.balance = data.balance ?? subject.balance;
            data.section = data.section ?? section.name;
            data.topic = data.topic ?? topic.name;
            data.literature = data.literature ?? topic.literature;
            data.threshold = data.threshold ?? threshold;

            const resolvedQuestionPrompt = this.getPrompt(
                topic.questionPrompt,
                section.questionPrompt,
                subject.questionPrompt
            );

            data.prompt = resolvedQuestionPrompt ?? "";

            if (!Array.isArray(data.subtopics) || !data.subtopics.every(item => typeof item === 'string')) {
                throw new BadRequestException('Subtopics musi być listą stringów');
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
                typeof r.subject !== 'string' ||
                typeof r.section !== 'string' ||
                typeof r.topic !== 'string' ||
                typeof r.literature !== 'string' ||
                !Array.isArray(r.subtopics) ||
                !Array.isArray(r.errors) ||
                !Array.isArray(r.outputSubtopics) ||
                typeof r.attempt !== 'number' ||
                typeof r.text !== 'string'
            ) {
                throw new BadRequestException('Niepoprawna struktura odpowiedzi z serwera.');
            }

            return {
                statusCode: 201,
                message: "Generacja tekstu zadania udane",
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

    async writingAIGenerate(
        userId: number,
        subjectId: number,
        sectionId: number,
        topicId: number,
        data: WritingAIGenerate,
        signal?: AbortSignal
    ) {
        const url = `${this.fastapiUrl}/admin/writing-generate`;

        try {
            const [subject, section, topic] = await Promise.all([
                this.prismaService.subject.findUnique({ where: { id: subjectId } }),
                this.prismaService.section.findUnique({ where: { id: sectionId } }),
                this.prismaService.topic.findUnique({ where: { id: topicId } }),
            ]);
            if (!subject) throw new BadRequestException('Przedmiot nie został znaleziony');
            if (!section) throw new BadRequestException('Dział nie został znaleziony');
            if (!topic) throw new BadRequestException('Temat nie został znaleziony');

            data.subject = data.subject ?? subject.name;
            data.information = data.information ?? topic.information;
            data.accounts = data.accounts ?? subject.accounts;
            data.balance = data.balance ?? subject.balance;
            data.section = data.section ?? section.name;
            data.topic = data.topic ?? topic.name;
            data.literature = data.literature ?? topic.literature;

            const resolvedQuestionPrompt = this.getPrompt(
                topic.questionPrompt,
                section.questionPrompt,
                subject.questionPrompt
            );

            data.prompt = resolvedQuestionPrompt ?? "";

            if (!Array.isArray(data.errors) || !data.errors.every(item => typeof item === 'string')) {
                throw new BadRequestException('Errors musi być listą stringów');
            }

            const response$ = this.httpService.post(url, data, { signal });
            const response = await firstValueFrom(response$);
            const r = response.data;

            if (
                typeof r.prompt !== 'string' ||
                typeof r.changed !== 'string' ||
                typeof r.subject !== 'string' ||
                typeof r.section !== 'string' ||
                typeof r.topic !== 'string' ||
                typeof r.literature !== 'string' ||
                !Array.isArray(r.errors) ||
                typeof r.attempt !== 'number' ||
                typeof r.text !== 'string'
            ) {
                throw new BadRequestException('Niepoprawna struktura odpowiedzi z serwera.');
            }

            return {
                statusCode: 201,
                message: "Generacja tekstu zadania udane",
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

    async interactiveTaskAIGenerate(
        userId: number,
        subjectId: number,
        sectionId: number,
        topicId: number,
        data: InteractiveTaskAIGenerate,
        signal?: AbortSignal
    ) {
        const url = `${this.fastapiUrl}/admin/interactive-task-generate`;

        try {
            const [subject, section, topic] = await Promise.all([
                this.prismaService.subject.findUnique({ where: { id: subjectId } }),
                this.prismaService.section.findUnique({ where: { id: sectionId } }),
                this.prismaService.topic.findUnique({ where: { id: topicId } }),
            ]);
            if (!subject) throw new BadRequestException('Przedmiot nie został znaleziony');
            if (!section) throw new BadRequestException('Dział nie został znaleziony');
            if (!topic) throw new BadRequestException('Temat nie został znaleziony');

            const userSubject = await this.prismaService.userSubject.findUnique({
                where: { userId_subjectId: { userId, subjectId } },
                select: { threshold: true }
            });
            const threshold = userSubject?.threshold ?? 50;

            const topics = await this.prismaService.$queryRaw<any[]>`
                SELECT 
                    t.name,
                    COALESCE(ut.percent, 0) AS "percent",
                    t."partId" AS "topicPartId",
                    s."partId" AS "sectionPartId"
                FROM "Topic" t
                INNER JOIN "Section" s ON s.id = t."sectionId" AND s."subjectId" = ${subjectId}
                LEFT JOIN "UserTopic" ut
                    ON ut."topicId" = t.id 
                    AND ut."userId" = ${userId}
                    AND ut."subjectId" = ${subjectId}
                WHERE t."subjectId" = ${subjectId}
                ORDER BY s."partId" ASC, t."partId" ASC;
            `;

            const finalSubtopics = topics.filter(s => s.percent >= threshold);
            const formattedSubtopics: [string, number][] = finalSubtopics.map(s => [s.name, s.percent]);

            const wordsWithMinCount = await this.prismaService.$queryRaw<any[]>`
                WITH word_usage AS (
                    SELECT 
                        w.id,
                        w.text,
                        w.frequency,
                        w."totalCorrectCount",
                        w."totalAttemptCount",
                        COALESCE(COUNT(tw."taskId"), 0)::integer AS usage_count
                    FROM "Word" w
                    LEFT JOIN "TaskWord" tw ON tw."wordId" = w.id
                    LEFT JOIN "Task" t ON t.id = tw."taskId" 
                        AND t."userId" = ${userId}
                        AND t."topicId" = ${topicId}
                    WHERE w."userId" = ${userId}
                        AND w."topicId" = ${topicId}
                        AND w."subjectId" = ${subjectId}
                    GROUP BY w.id, w.text, w.frequency, w."totalCorrectCount", w."totalAttemptCount"
                ),
                min_usage AS (
                    SELECT MIN(usage_count) as min_count FROM word_usage
                )
                SELECT 
                    wu.id,
                    wu.text,
                    wu.frequency,
                    wu."totalCorrectCount",
                    wu."totalAttemptCount",
                    wu.usage_count
                FROM word_usage wu, min_usage mu
                WHERE wu.usage_count = mu.min_count
                ORDER BY 
                    wu.frequency DESC,
                    wu."totalCorrectCount" ASC,
                    wu."totalAttemptCount" ASC,
                    wu.text ASC;
            `;

            const wordsForData: string[] = wordsWithMinCount.map(w => w.text);

            data.subject = data.subject ?? subject.name;
            data.section = data.section ?? section.name;
            data.topic = data.topic ?? topic.name;
            data.subtopics = data.subtopics ?? formattedSubtopics;
            data.difficulty = data.difficulty ?? section.difficulty;
            data.words = data.words ?? wordsForData;

            const resolvedQuestionPrompt = this.getPrompt(
                topic.questionPrompt,
                section.questionPrompt,
                subject.questionPrompt
            );

            data.prompt = resolvedQuestionPrompt ?? "";

            if (!Array.isArray(data.subtopics) || !data.subtopics.every(item =>
                Array.isArray(item) &&
                item.length === 2 &&
                typeof item[0] === 'string' &&
                typeof item[1] === 'number'
            )) throw new BadRequestException('Subtopics musi być listą par [string, number]');

            if (!Array.isArray(data.errors) || !data.errors.every(item => typeof item === 'string')) {
                throw new BadRequestException('Errors musi być listą stringów');
            }

            const response$ = this.httpService.post(url, data, { signal });
            const response = await firstValueFrom(response$);
            const r = response.data;

            if (
                typeof r.prompt !== 'string' ||
                typeof r.changed !== 'string' ||
                typeof r.subject !== 'string' ||
                typeof r.section !== 'string' ||
                typeof r.difficulty !== 'string' ||
                typeof r.topic !== 'string' ||
                !Array.isArray(r.subtopics) ||
                !Array.isArray(r.words) ||
                !Array.isArray(r.outputWords) ||
                !Array.isArray(r.errors) ||
                typeof r.attempt !== 'number' ||
                typeof r.text !== 'string' ||
                typeof r.translate !== 'string'
            ) throw new BadRequestException('Niepoprawna struktura odpowiedzi z serwera.');

            return {
                statusCode: 201,
                message: "Generacja tekstu zadania udane",
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

    async optionsAIGenerate(
        subjectId: number,
        sectionId: number,
        topicId: number,
        data: OptionsAIGenerate,
        signal?: AbortSignal
    ) {
        const url = `${this.fastapiUrl}/admin/options-generate`;
        
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

            const resolvedAnswersPrompt = this.getPrompt(
                topic.answersPrompt,
                section.answersPrompt,
                subject.answersPrompt
            );
            
            data.prompt = resolvedAnswersPrompt ?? "";
            data.accounts = data.accounts ?? subject.accounts;
            data.balance = data.balance ?? subject.balance;
            data.information = data.information ?? topic.information;

            if (!Array.isArray(data.errors) || !data.errors.every(item => typeof item === 'string')) {
                throw new BadRequestException('Errors musi być listą stringów');
            }

            if (!Array.isArray(data.options) || !data.options.every(item => typeof item === 'string')) {
                throw new BadRequestException('Options musi być listą stringów');
            }

            const response$ = this.httpService.post(url, data, { signal });
            const response = await firstValueFrom(response$);
            const r = response.data;

            if (
                typeof r.prompt !== 'string' ||
                typeof r.changed !== 'string' ||
                !Array.isArray(r.errors) ||
                !Array.isArray(r.options) ||
                typeof r.attempt !== 'number' ||
                typeof r.text !== 'string' ||
                typeof r.correctOptionIndex !== 'number' ||
                typeof r.solution !== 'string' ||
                typeof r.randomOption !== 'number'
            ) {
                throw new BadRequestException('Niepoprawna struktura odpowiedzi z serwera.');
            }

            if (!r.errors.every((item: any) => typeof item === 'string')) {
                throw new BadRequestException('Errors w odpowiedzi musi być listą stringów');
            }

            if (!r.options.every((item: any) => typeof item === 'string')) {
                throw new BadRequestException('Options w odpowiedzi musi być listą stringów');
            }

            if (r.subtopics && (!Array.isArray(r.subtopics) || !r.subtopics.every((item: any) => typeof item === 'string'))) {
                throw new BadRequestException('Subtopics w odpowiedzi musi być listą stringów');
            }

            return {
                statusCode: 201,
                message: "Generacja wariantów odpowiedzi zadania udane",
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

    async problemsAIGenerate(
        subjectId: number,
        sectionId: number,
        topicId: number,
        data: ProblemsAIGenerate,
        signal?: AbortSignal
    ) {
        const url = `${this.fastapiUrl}/admin/problems-generate`;
        
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

            data.subject = data.subject ?? subject.name;
            data.information = data.information ?? topic.information;
            data.accounts = data.accounts ?? subject.accounts;
            data.balance = data.balance ?? subject.balance;
            data.section = data.section ?? section.name;
            data.topic = data.topic ?? topic.name;
            data.type = data.type ?? section.type;

            const resolvedClosedSubtopicsPrompt = this.getPrompt(
                topic.closedSubtopicsPrompt,
                section.closedSubtopicsPrompt,
                subject.closedSubtopicsPrompt
            );

            data.prompt = resolvedClosedSubtopicsPrompt ?? "";

            if (!Array.isArray(data.errors) || !data.errors.every(item => typeof item === 'string')) {
                throw new BadRequestException('Errors musi być listą stringów');
            }

            if (!Array.isArray(data.options) || !data.options.every(item => typeof item === 'string')) {
                throw new BadRequestException('Options musi być listą stringów');
            }

            if (!Array.isArray(data.subtopics) || !data.subtopics.every(item => typeof item === 'string')) {
                throw new BadRequestException('Subtopics musi być listą stringów');
            }

            if (!Array.isArray(data.outputSubtopics) || !data.outputSubtopics.every(item =>
                Array.isArray(item) &&
                item.length === 2 &&
                typeof item[0] === 'string' &&
                typeof item[1] === 'number'
            )) {
                throw new BadRequestException('OutputSubtopics musi być listą par [string, number]');
            }

            const response$ = this.httpService.post(url, data, { signal });
            const response = await firstValueFrom(response$);
            const r = response.data;

            if (
                typeof r.prompt !== 'string' ||
                typeof r.changed !== 'string' ||
                !Array.isArray(r.subtopics) ||
                !Array.isArray(r.errors) ||
                !Array.isArray(r.options) ||
                typeof r.attempt !== 'number' ||
                typeof r.correctOption !== 'string' ||
                typeof r.userOption !== 'string' ||
                typeof r.text !== 'string' ||
                typeof r.type !== 'string' ||
                typeof r.subject !== 'string' ||
                typeof r.section !== 'string' ||
                typeof r.topic !== 'string' ||
                typeof r.solution !== 'string' ||
                typeof r.explanation !== 'string'
            ) {
                throw new BadRequestException('Niepoprawna struktura odpowiedzi z serwera.');
            }

            if (!r.errors.every((item: any) => typeof item === 'string')) {
                throw new BadRequestException('Errors musi być listą stringów');
            }

            if (!Array.isArray(data.options) || !data.options.every(item => typeof item === 'string')) {
                throw new BadRequestException('Options musi być listą stringów');
            }

            if (!Array.isArray(data.subtopics) || !data.subtopics.every(item => typeof item === 'string')) {
                throw new BadRequestException('Subtopics musi być listą stringów');
            }

            return {
                statusCode: 201,
                message: "Generacja problemów odpowiedzi zadania udane",
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

    async chatAIGenerate(
        subjectId: number,
        sectionId: number,
        topicId: number,
        taskId: number,
        data: ChatAIGenerate,
        signal?: AbortSignal
    ) {
        const url = `${this.fastapiUrl}/admin/chat-generate`;
        
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

            const task = await this.prismaService.task.findUnique({
                where: { id: taskId },
            });

            if (!task) {
                throw new BadRequestException('Zadanie nie zostało znalezione');
            }

            data.explanation = data.explanation ?? task.explanation;
            data.style = data.style ?? false;
            data.subject = data.subject ?? subject.name;
            data.information = data.information ?? topic.information;
            data.accounts = data.accounts ?? subject.accounts;
            data.balance = data.balance ?? subject.balance;
            data.section = data.section ?? section.name;
            data.topic = data.topic ?? topic.name;

            if (data.mode === "STUDENT_ANSWER") {
                const resolvedChatPrompt = this.getPrompt(
                    topic.chatAnswerPrompt,
                    section.chatAnswerPrompt,
                    subject.chatAnswerPrompt
                );

                data.prompt = resolvedChatPrompt ?? "";
            }
            else {
                const resolvedChatPrompt = this.getPrompt(
                    topic.chatQuestionPrompt,
                    section.chatQuestionPrompt,
                    subject.chatQuestionPrompt
                );

                data.prompt = resolvedChatPrompt ?? "";
            }

            if (!Array.isArray(data.errors) || !data.errors.every(item => typeof item === 'string')) {
                throw new BadRequestException('Errors musi być listą stringów');
            }

            if (!Array.isArray(data.subtopics) || !data.subtopics.every(item => typeof item === 'string')) {
                throw new BadRequestException('Subtopics musi być listą stringów');
            }

            if (!Array.isArray(data.options) || !data.options.every(item => typeof item === 'string')) {
                throw new BadRequestException('Options musi być listą stringów');
            }

            const response$ = this.httpService.post(url, data, { signal });
            const response = await firstValueFrom(response$);
            const r = response.data;

            if (
                typeof r.prompt !== 'string' ||
                typeof r.changed !== 'string' ||
                !Array.isArray(r.errors) ||
                !Array.isArray(r.subtopics) ||
                !Array.isArray(r.options) ||
                typeof r.attempt !== 'number' ||
                typeof r.text !== 'string' ||
                typeof r.subject !== 'string' ||
                typeof r.section !== 'string' ||
                typeof r.topic !== 'string' ||
                typeof r.solution !== 'string' ||
                typeof r.userSolution !== 'string' ||
                typeof r.userOption !== 'string' ||
                typeof r.correctOption !== 'string' ||
                typeof r.chat !== 'string' ||
                typeof r.mode !== 'string' ||
                typeof r.style !== 'boolean' ||
                typeof r.chatFinished !== 'boolean'
            ) {
                throw new BadRequestException('Niepoprawna struktura odpowiedzi z serwera.');
            }

            if (!r.errors.every((item: any) => typeof item === 'string')) {
                throw new BadRequestException('Errors musi być listą stringów');
            }

            if (!r.subtopics.every((item: any) => typeof item === 'string')) {
                throw new BadRequestException('Subtopics musi być listą stringów');
            }

            if (!r.options.every((item: any) => typeof item === 'string')) {
                throw new BadRequestException('Options musi być listą stringów');
            }

            return {
                statusCode: 201,
                message: "Generacja czatu zadania udane",
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

    async solutionGuideAIGenerate(
        subjectId: number,
        sectionId: number,
        topicId: number,
        taskId: number,
        data: SolutionGuideAIGenerate,
        signal?: AbortSignal
    ) {
        const url = `${this.fastapiUrl}/admin/solution-guide-generate`;
        
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

            const task = await this.prismaService.task.findUnique({
                where: { id: taskId },
            });

            if (!task) {
                throw new BadRequestException('Zadanie nie zostało znalezione');
            }

            if (task.solutionGuide !== null && task.solutionGuide !== "") {
                throw new BadRequestException('Poradnik rozwiązania już istnieje');
            }

            const resolvedSolutionGuidePrompt = this.getPrompt(
                topic.solutionGuidePrompt,
                section.solutionGuidePrompt,
                subject.solutionGuidePrompt
            );
            
            data.prompt = resolvedSolutionGuidePrompt ?? "";
            data.information = data.information ?? topic.information;
            data.accounts = data.accounts ?? subject.accounts;
            data.balance = data.balance ?? subject.balance;
            data.subject = data.subject ?? subject.name;
            data.section = data.section ?? section.name;
            data.topic = data.topic ?? topic.name;
            data.text = data.text ?? task.text;

            if (!Array.isArray(data.errors) || !data.errors.every(item => typeof item === 'string')) {
                throw new BadRequestException('Errors musi być listą stringów');
            }

            const response$ = this.httpService.post(url, data, { signal });
            const response = await firstValueFrom(response$);
            const r = response.data;

            if (
                typeof r.prompt !== 'string' ||
                typeof r.changed !== 'string' ||
                !Array.isArray(r.errors) ||
                typeof r.attempt !== 'number' ||
                typeof r.solutionGuide !== 'string' ||
                typeof r.subject !== 'string' ||
                typeof r.section !== 'string' ||
                typeof r.topic !== 'string' ||
                typeof r.text !== 'string'
            ) {
                throw new BadRequestException('Niepoprawna struktura odpowiedzi z serwera.');
            }

            if (!r.errors.every((item: any) => typeof item === 'string')) {
                throw new BadRequestException('Errors musi być listą stringów');
            }

            return {
                statusCode: 201,
                message: "Generacja poradnika rozwiązania zadania udane",
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

    async createTaskTransaction(
        userId: number,
        subjectId: number,
        sectionId: number,
        topicId: number,
        taskData: TaskCreateRequest
    ) {
        try {
            return await this.prismaService.$transaction(async (tx) => {
                await this.syncUserProgressTables(userId, subjectId, tx);

                let taskId: number;

                if (taskData.id) {
                    const existingTask = await tx.task.findUnique({
                        where: { id: taskData.id, userId }
                    });

                    if (!existingTask) {
                        throw new BadRequestException('Zadanie nie zostało znalezione');
                    }

                    const updateData: any = {};
                    if (taskData.text !== undefined) updateData.text = taskData.text;
                    if (taskData.solution !== undefined) updateData.solution = taskData.solution;
                    if (taskData.options !== undefined) updateData.options = taskData.options;
                    if (taskData.correctOptionIndex !== undefined) updateData.correctOptionIndex = taskData.correctOptionIndex;
                    if (taskData.stage !== undefined) updateData.stage = taskData.stage;

                    await tx.task.update({
                        where: { id: taskData.id, userId },
                        data: updateData
                    });

                    taskId = taskData.id;
                } else {
                    const lastTask = await tx.task.findFirst({
                        where: { userId, topicId },
                        orderBy: { order: 'desc' },
                        select: { order: true }
                    });

                    const order = (lastTask?.order ?? 0) + 1;

                    const newTask = await tx.task.create({
                        data: {
                            text: taskData.text,
                            solution: taskData.solution,
                            options: taskData.options,
                            correctOptionIndex: taskData.correctOptionIndex,
                            stage: taskData.stage ?? 0,
                            topicId,
                            userId,
                            order
                        }
                    });

                    taskId = newTask.id;
                }

                const hasSubtopics = Array.isArray(taskData.taskSubtopics) && taskData.taskSubtopics.length > 0;

                if (hasSubtopics) {
                    await tx.subtopicProgress.deleteMany({ where: { taskId, userId } });

                    for (const subtopicName of taskData.taskSubtopics) {
                        const { subtopic } = await this.subtopicService.findSubtopicByName(
                            subjectId,
                            sectionId,
                            topicId,
                            subtopicName,
                            tx
                        );

                        await tx.subtopicProgress.create({
                            data: {
                                percent: 0,
                                subtopicId: subtopic.id,
                                taskId,
                                userId
                            }
                        });
                    }
                } else {
                    let percentWords = 0;

                    if (taskData.words && taskData.words.length > 0) {
                        const taskWords = await tx.word.findMany({
                            where: {
                                userId,
                                topicId,
                                text: { in: taskData.words }
                            }
                        });

                        for (const w of taskWords) {
                            await tx.taskWord.upsert({
                                where: { taskId_wordId: { taskId, wordId: w.id } },
                                update: {},
                                create: { taskId, wordId: w.id }
                            });
                        }

                        if (taskWords.length > 0) {
                            let total = 0;
                            
                            for (const w of taskWords) {
                                let wordPercent = 0;
                                if (w.totalAttemptCount > 0) {
                                    wordPercent = Math.min(100, Math.ceil(w.totalCorrectCount / w.totalAttemptCount * 100));
                                }
                                total += wordPercent;
                            }
                            
                            percentWords = Math.ceil(total / taskWords.length);
                        }
                    }

                    if (taskData.explanation && taskData.explanation.trim() !== '') {
                        const percentAudio = taskData.percent ?? 0;
                        const finalPercent = Math.ceil((percentAudio + percentWords) / 2);

                        await tx.task.update({
                            where: { id: taskId, userId },
                            data: {
                                explanation: taskData.explanation,
                                percent: finalPercent,
                                percentAudio,
                                percentWords,
                            }
                        });

                        await this.updateTopicAndSectionPercentsByTasks(
                            userId,
                            subjectId,
                            sectionId,
                            topicId,
                            tx
                        );
                    }
                }

                return {
                    statusCode: 200,
                    message: taskData.id
                        ? 'Zadanie zostało zaktualizowane'
                        : 'Zadanie zostało dodane'
                };
            }, { timeout: 900000 });
        } catch (error) {
            console.log(error);
            throw new InternalServerErrorException(`Nie udało się zapisać zadanie: ${error}`);
        }
    }

    async audioTaskTransaction(
        userId: number,
        subjectId: number,
        sectionId: number,
        topicId: number,
        taskId: number,
        text: string,
        stage: number,
        language: string
    ) {
        try {
            await this.optionsService.deleteAudioFileByTaskId(userId, taskId);

            const { sentences } = await this.optionsService.textSplitIntoSentences(
                text,
                language
            );

            let partId = 1;

            for (const sentence of sentences) {
                await this.optionsService.generateTTS(
                    userId,
                    taskId,
                    sentence,
                    partId,
                    language
                );

                partId++;
            }

            await this.prismaService.$transaction(
                async (prisma) => {
                    await prisma.task.update({
                    where: { id: taskId, userId },
                        data: {
                            text,
                            stage,
                        },
                    });
                },
                {
                    timeout: 900000,
                }
            );

            return {
                statusCode: 200,
                message: 'Audio zostało zapisane',
            };

        } catch (error) {
            throw new InternalServerErrorException(`Nie udało się zapisać audio: ${error?.message ?? error}`);
        }
    }

    async updateSubtopicsProgress(
        userId: number,
        subjectId: number,
        sectionId: number,
        topicId: number,
        subtopicIds: number[],
        tx: Prisma.TransactionClient
    ) {
        if (!subtopicIds.length) return;

        const updatedSubtopics = await tx.subtopic.findMany({
            where: { id: { in: subtopicIds }, subjectId },
            include: { progresses: { where: { userId }, orderBy: { updatedAt: 'asc' } } }
        });

        const subtopicPercents = updatedSubtopics.map(sub => {
            const progresses = sub.progresses;
            if (!progresses.length) return { id: sub.id, percent: 0 };
            let ema = progresses[0].percent;
            const alpha = 0.7;
            for (let i = 1; i < progresses.length; i++) {
                ema = ema * (1 - alpha) + progresses[i].percent * alpha;
            }
            return { id: sub.id, percent: Math.min(100, Math.ceil(ema)) };
        });

        for (const sub of subtopicPercents) {
            await tx.userSubtopic.update({
                where: {
                    userId_subjectId_subtopicId: {
                        userId,
                        subjectId,
                        subtopicId: sub.id
                    }
                },
                data: { percent: sub.percent }
            });
        }

        const userSubject = await tx.userSubject.findUnique({
            where: { userId_subjectId: { userId, subjectId } }
        });

        const getDetailLevels = (level: string): SubjectDetailLevel[] => {
            switch (level) {
                case 'BASIC': return ['BASIC'];
                case 'EXPANDED': return ['BASIC', 'EXPANDED'];
                case 'ACADEMIC': return ['BASIC', 'EXPANDED', 'ACADEMIC'];
                default: return ['BASIC'];
            }
        };

        const allowedLevels = getDetailLevels(userSubject?.detailLevel || 'BASIC');

        const userSubtopicPercents = await tx.userSubtopic.findMany({
            where: {
                userId,
                subjectId,
                subtopic: {
                    topicId,
                    detailLevel: { in: allowedLevels }
                }
            },
            select: { percent: true }
        });

        const relevantPercents = userSubtopicPercents.map(us => us.percent);

        const topicPercent = relevantPercents.length
            ? Math.min(
                100,
                Math.ceil(relevantPercents.reduce((a, b) => a + b, 0) / relevantPercents.length)
            )
            : 0;

        await tx.userTopic.updateMany({
            where: { topicId, userId, subjectId },
            data: { percent: topicPercent }
        });

        const topicsInSection = await tx.userTopic.findMany({
            where: { sectionId, userId, subjectId }
        });

        const sectionPercent = topicsInSection.length
            ? Math.min(
                100,
                Math.ceil(topicsInSection.reduce((a, t) => a + t.percent, 0) / topicsInSection.length)
            )
            : 0;

        await tx.userSection.updateMany({
            where: { sectionId, userId, subjectId },
            data: { percent: sectionPercent }
        });

        return { statusCode: 200, message: 'Procenty podtematów zostały zaktualizowane' };
    }

    async updateTopicAndSectionPercentsByTasks(
        userId: number,
        subjectId: number,
        sectionId: number,
        topicId: number,
        tx: Prisma.TransactionClient
    ) {
        const tasks = await tx.task.findMany({
            where: {
                userId,
                topicId,
                finished: true
            },
            select: { percent: true }
        });

        const averageTaskPercent = tasks.length
            ? Math.min(
                100,
                Math.ceil(tasks.reduce((a, t) => a + (t.percent ?? 0), 0) / tasks.length)
            )
            : 0;

        const words = await tx.word.findMany({
            where: {
                userId,
                topicId,
                subjectId
            },
            select: {
                totalAttemptCount: true
            }
        });

        const totalWords = words.length;

        const wordsWithAttempts = words.filter(
            w => (w.totalAttemptCount ?? 0) > 0
        ).length;

        const coveragePercent = totalWords > 0
            ? Math.ceil((wordsWithAttempts / totalWords) * 100)
            : 0;

        const topicPercent = Math.min(
            100,
            Math.ceil((averageTaskPercent * coveragePercent) / 100)
        );

        await tx.userTopic.updateMany({
            where: { userId, subjectId, topicId },
            data: { percent: topicPercent }
        });

        const topicsInSection = await tx.userTopic.findMany({
            where: { userId, subjectId, sectionId },
            select: { percent: true }
        });

        const sectionPercent = topicsInSection.length
            ? Math.min(
                100,
                Math.ceil(
                    topicsInSection.reduce((a, t) => a + (t.percent ?? 0), 0) /
                    topicsInSection.length
                )
            )
            : 0;

        await tx.userSection.updateMany({
            where: { userId, subjectId, sectionId },
            data: { percent: sectionPercent }
        });

        return {
            statusCode: 200,
            message: 'Procenty tematu i działu zostały zaktualizowane (tasks + coverage)'
        };
    }

    async subtopicsProgressTaskTransaction(
        userId: number,
        subjectId: number,
        sectionId: number,
        topicId: number,
        taskId: number,
        data: SubtopicsProgressUpdateRequest
    ) {
        try {
            return await this.prismaService.$transaction(async (tx) => {
                await this.syncUserProgressTables(userId, subjectId, tx);
                
                const subtopicIds: number[] = [];

                for (const sub of data.subtopics) {
                    const { subtopic } = await this.subtopicService.findSubtopicByName(
                        subjectId,
                        sectionId,
                        topicId,
                        sub.name,
                        tx
                    );

                    subtopicIds.push(subtopic.id);

                    const subtopicProgress = await tx.subtopicProgress.findFirst({
                        where: { taskId, userId, subtopicId: subtopic.id }
                    });

                    if (!subtopicProgress) throw new BadRequestException('SubtopicProgress nie został znaleziony');

                    await tx.subtopicProgress.update({
                        where: { id: subtopicProgress.id },
                        data: { percent: sub.percent }
                    });
                }

                const averagePercent = await tx.subtopicProgress.aggregate({
                    where: { taskId, userId },
                    _avg: { percent: true }
                });

                await tx.task.update({
                    where: { id: taskId },
                    data: { explanation: data.explanation, percent: averagePercent._avg.percent || 0 }
                });

                await this.updateSubtopicsProgress(userId, subjectId, sectionId, topicId, subtopicIds, tx);

                return { statusCode: 200, message: 'Podtematy zadania zostały policzone' };
            }, { timeout: 900000 });
        } catch (error) {
            throw new InternalServerErrorException(`Nie udało się zaktualizować podtematów zadania: ${error}`);
        }
    }

    async updateTaskUserSolution(
        userId: number,
        subjectId: number,
        sectionId: number,
        topicId: number,
        id: number,
        userData: TaskUserSolutionRequest
    ) {
        try {
            const task = await this.prismaService.task.findUnique({
                where: { id, userId }
            });

            if (!task) {
                throw new BadRequestException('Zadanie nie zostało znalezione');
            }

            const updatedTask = await this.prismaService.task.update({
                where: { id, userId },
                data: {
                    ...userData,
                    answered: true,
                }
            });

            return {
                statusCode: 200,
                message: 'Zadanie zostało zaktualizowane pomyślnie',
                task: updatedTask
            }
        }
        catch (error) {
            throw new InternalServerErrorException('Nie udało się zaktualizować zadania');
        }
    }

    async updateFinished(
        userId: number,
        subjectId: number,
        sectionId: number,
        topicId: number,
        id: number,
    ) {
        try {
            const existing = await this.prismaService.task.findUnique({ where: { id } });
            if (!existing) {
                return {
                    statusCode: 404,
                    message: `Zadanie nie zostało znalezione`,
                };
            }

            const updatedTask = await this.prismaService.task.update({
                where: { id },
                data: {
                    finished: true
                }
            });

            return {
                statusCode: 200,
                message: 'Zadanie zostało pomyślnie zakończone',
                task: updatedTask,
            };
        }
        catch (error) {
            console.error(`Nie udało się zaktualizować zakończenie zadania:`, error);
            throw new InternalServerErrorException('Błąd podczas aktualizacji zakończenie zadania');
        }
    }

    async updateSolutionGuide(
        userId: number,
        subjectId: number,
        sectionId: number,
        topicId: number,
        id: number,
        data: SolutionGuideRequest
    ) {
        try {
            const task = await this.prismaService.task.findUnique({
                where: { id, userId }
            });

            if (!task) {
                throw new BadRequestException('Zadanie nie zostało znalezione');
            }

            if (task.solutionGuide !== null && task.solutionGuide !== "") {
                throw new BadRequestException('Poradnik rozwiązania już istnieje');
            }

            const updatedTask = await this.prismaService.task.update({
                where: { id, userId },
                data: {
                    solutionGuide: data.solutionGuide
                }
            });

            return {
                statusCode: 200,
                message: 'Zadanie zostało zaktualizowane pomyślnie',
                task: updatedTask
            }
        }
        catch (error) {
            if (error instanceof BadRequestException) {
                throw error;
            }

            throw new InternalServerErrorException('Nie udało się zaktualizować zadania');
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

    async deleteTask(
        userId: number,
        subjectId: number,
        sectionId: number,
        topicId: number,
        id: number
    ) {
        try {
            const task = await this.prismaService.task.findFirst({
                where: { id, userId, topicId },
                include: {
                    audioFiles: true,
                    progresses: { select: { subtopicId: true } }
                }
            });

            if (!task) throw new BadRequestException('Zadanie nie zostało znalezione');

            for (const audioFile of task.audioFiles) {
                if (!audioFile.url) continue;
                try {
                    const audioKey = this.extractKeyFromUrl(audioFile.url);
                    if (audioKey) await this.storageService.deleteFile(audioKey);
                } catch (e) {
                    console.error(`Nie udało się usunąć pliku audio z S3 (ID: ${audioFile.id}):`, e);
                }
            }

            return await this.prismaService.$transaction(async (tx) => {
                await tx.task.delete({ where: { userId, id } });

                const subtopicIds = Array.from(new Set(task.progresses.map(p => p.subtopicId)));

                if (subtopicIds.length > 0) {
                    await this.updateSubtopicsProgress(userId, subjectId, sectionId, topicId, subtopicIds, tx);
                } else {
                    await this.updateTopicAndSectionPercentsByTasks(userId, subjectId, sectionId, topicId, tx);
                }

                return { statusCode: 200, message: 'Usuwanie zadania zostało udane' };
            }, { timeout: 900000 });
        } catch (error) {
            console.error('Błąd podczas usuwania zadania:', error);
            throw new InternalServerErrorException('Nie udało się usunąć zadanie');
        }
    }

    async createWord(
        userId: number,
        subjectId: number,
        sectionId: number,
        topicId: number,
        taskId: number,
        text: string,
    ) {
        try {
            text = text.toLowerCase();

            let word = await this.prismaService.word.findFirst({
                where: {
                    userId,
                    subjectId,
                    text,
                },
            });

            if (!word) {
                word = await this.prismaService.word.create({
                    data: {
                        text,
                        finished: false,
                        topicId: null,
                        userId,
                        subjectId
                    },
                });
            } else {
                word = await this.prismaService.word.update({
                    where: { id: word.id },
                    data: {
                        finished: false,
                    },
                });
            }

            const existingTaskWord = await this.prismaService.taskWord.findUnique({
                where: {
                    taskId_wordId: {
                        taskId,
                        wordId: word.id,
                    },
                },
            });

            if (!existingTaskWord) {
                await this.prismaService.taskWord.create({
                    data: {
                        taskId,
                        wordId: word.id,
                    },
                });
            }

            return {
                statusCode: 200,
                message: 'Wyraz został dodany pomyślnie',
                word,
            };
        } catch (error) {
            console.error(error);
            throw new InternalServerErrorException('Nie udało się dodać wyrazu');
        }
    }
}