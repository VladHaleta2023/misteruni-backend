import { BadRequestException, HttpException, HttpStatus, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExamAIGenerate } from './dto/exam-generate.dto';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { ExamCreateRequest } from './dto/exam-request.dto';
import { SubjectDetailLevel } from '@prisma/client';

@Injectable()
export class ExamService {
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

    private async getExamTotalTimeSpentByTasks(
        userId: number,
        examId: number,
    ) {
        try {
            const taskStatsResult = await this.prismaService.$queryRaw<{ totalTimeSpentByTasks: number }[]>`
                SELECT 
                    COALESCE(SUM(t."timeSpentSeconds"), 0)::int as "totalTimeSpentByTasks"
                FROM "Task" t
                WHERE t."examId" = ${examId}
                AND t."userId" = ${userId}
            `;

            return taskStatsResult[0]?.totalTimeSpentByTasks ?? 0;
        }
        catch (error: any) {
            console.error('SQL Error in getExamTotalTimeSpentByTasks:', error);
            return 0;
        }
    }

    private async getExamTopicsCount(
        examId: number,
    ) {
        try {
            const topicsCountResult = await this.prismaService.$queryRaw<{ topicsCount: number }[]>`
                SELECT 
                    COUNT(et."topicId")::int as "topicsCount"
                FROM "ExamTopic" et
                WHERE et."examId" = ${examId}
            `;

            return topicsCountResult[0]?.topicsCount ?? 0;
        }
        catch (error: any) {
            console.error('SQL Error in getExamTopicsCount:', error);
            return 0;
        }
    }

    private async getExamFinishedTasksCount(
        userId: number,
        examId: number,
    ) {
        try {
            const finishedTasksCountResult = await this.prismaService.$queryRaw<{ finishedTasksCount: number }[]>`
                SELECT COUNT(*)::int as "finishedTasksCount"
                FROM "Task"
                WHERE "examId" = ${examId}
                AND "userId" = ${userId}
                AND finished = true
            `;

            return finishedTasksCountResult[0]?.finishedTasksCount ?? 0;
        }
        catch (error: any) {
            console.error('SQL Error in getExamFinishedTasksCount:', error);
            return 0;
        }
    }

    private async examIsFinished(
        userId: number,
        examId: number,
        examTotalTimeSpent: number,
        examTotalTimeSpentByTasks: number
    ) {
        try {
            const examTopicsCount = await this.getExamTopicsCount(examId);
            const examFinishedTasksCount = await this.getExamFinishedTasksCount(userId, examId);

            if (examTotalTimeSpentByTasks >= examTotalTimeSpent || examTopicsCount === examFinishedTasksCount)
                return true;
            else
                return false;
        } catch (error: any) {
            console.error('SQL Error in examIsFinished:', error);
            return false;
        }
    }

    private async findExamTopics(
        userId: number,
        subjectId: number,
        examId: number,
        threshold: number
    ) {
        try {
            const result = await this.prismaService.$queryRaw<any[]>`
                WITH exam_topics_data AS (
                    SELECT 
                        t.id,
                        t.name,
                        t."sectionId",
                        t."subjectId",
                        et."partId" AS "partId",
                        t.type,
                        t.frequency,
                        t."createdAt",
                        t."updatedAt",
                        t.information,
                        t.literature,
                        t."noteBasicLevel",
                        t."noteExpandedLevel",
                        t.difficulty,
                        CASE 
                            WHEN us."detailLevel" = 'EXPANDED' THEN t."noteExpandedLevel"
                            ELSE t."noteBasicLevel"
                        END as "topicNote"
                    FROM "ExamTopic" et
                    JOIN "Topic" t ON et."topicId" = t.id
                    JOIN "UserSubject" us ON us."userId" = ${userId} 
                        AND us."subjectId" = ${subjectId}
                    WHERE et."examId" = ${examId}
                    AND t."subjectId" = ${subjectId}
                    ORDER BY et."partId" ASC
                ),
                task_data AS (
                    SELECT DISTINCT ON (t."topicId")
                        t."topicId",
                        t.id as task_id,
                        t.text,
                        t.options,
                        t."correctOptionIndex",
                        t.solution,
                        t."userSolution",
                        t."userOptionIndex",
                        t."order",
                        t.finished,
                        t."createdAt",
                        t."updatedAt",
                        t.stage,
                        t.answered,
                        t.percent,
                        t.explanation,
                        t."percentAudio",
                        t."percentWords",
                        t."chatFinished",
                        t.chat,
                        t."timeSpentSeconds",
                        t."examId"
                    FROM "Task" t
                    WHERE t."examId" = ${examId}
                    AND t."userId" = ${userId}
                    AND t."subjectId" = ${subjectId}
                    ORDER BY t."topicId", t."order" ASC
                ),
                exam_topics_with_task AS (
                    SELECT 
                        etd.*,
                        td.finished as task_finished,
                        td.task_id,
                        CASE 
                            WHEN td.task_id IS NOT NULL THEN 
                                jsonb_build_object(
                                    'id', td.task_id,
                                    'text', td.text,
                                    'options', td.options,
                                    'correctOptionIndex', td."correctOptionIndex",
                                    'solution', td.solution,
                                    'userSolution', td."userSolution",
                                    'userOptionIndex', td."userOptionIndex",
                                    'order', td."order",
                                    'finished', td.finished,
                                    'createdAt', td."createdAt",
                                    'updatedAt', td."updatedAt",
                                    'stage', td.stage,
                                    'answered', td.answered,
                                    'percent', td.percent,
                                    'explanation', td.explanation,
                                    'percentAudio', td."percentAudio",
                                    'percentWords', td."percentWords",
                                    'chatFinished', td."chatFinished",
                                    'chat', td.chat,
                                    'timeSpentSeconds', td."timeSpentSeconds",
                                    'examId', td."examId",
                                    'status', CASE
                                        WHEN td.percent = 0 THEN 'started'
                                        WHEN td.percent >= ${threshold}::int THEN 'completed'
                                        ELSE 'progress'
                                    END
                                )
                            ELSE NULL
                        END as task
                    FROM exam_topics_data etd
                    LEFT JOIN task_data td ON etd.id = td."topicId"
                )
                SELECT 
                    id,
                    name,
                    "sectionId",
                    "subjectId",
                    "partId",
                    type,
                    frequency,
                    "createdAt",
                    "updatedAt",
                    information,
                    literature,
                    "topicNote",  -- Заменяем noteBasicLevel и noteExpandedLevel на topicNote
                    difficulty,
                    task
                FROM exam_topics_with_task
                ORDER BY 
                    CASE 
                        WHEN task_id IS NULL THEN 2
                        WHEN task_finished = false THEN 1
                        WHEN task_finished = true THEN 3
                        ELSE 4
                    END,
                    "partId" ASC
            `;

            return result.map(row => ({
                id: row.id,
                name: row.name,
                sectionId: row.sectionId,
                subjectId: row.subjectId,
                partId: row.partId,
                type: row.type,
                frequency: row.frequency,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
                information: row.information,
                literature: row.literature,
                topicNote: row.topicNote,  // Только одно поле
                difficulty: row.difficulty,
                task: row.task
            }));
        } catch (error: any) {
            console.error('SQL Error in findExamTopics:', error);
            return [];
        }
    }

    private getStatus(percent: number, userThreshold: number): string {
        if (percent === 0) return "started";
        if (percent >= userThreshold) return "completed";
        return "progress";
    }

    private async buildExam(
        userId: number,
        subjectId: number,
        exam: any,
        subject: any,
        threshold: number
    ) {
        const examTotalTimeSpentByTasks = await this.getExamTotalTimeSpentByTasks(userId, exam.id);

        const examFinished = await this.examIsFinished(
            userId,
            exam.id,
            subject.totalTimeSpent * 60,
            examTotalTimeSpentByTasks
        );

        const topics = await this.findExamTopics(userId, subjectId, exam.id, threshold);

        const remainingExamTimeSeconds = Math.max(
            0,
            subject.totalTimeSpent * 60 - examTotalTimeSpentByTasks
        );

        const totalPercent = topics.reduce(
            (sum, topic) => sum + (topic.task?.percent ?? 0),
            0
        );

        const averagePercent =
            topics.length > 0 ? Math.round(totalPercent / topics.length) : 0;

        const examStatus = this.getStatus(averagePercent, threshold);

        return {
            ...exam,
            finished: examFinished,
            remainingExamTimeSeconds,
            percent: averagePercent,
            status: examStatus,
            topics
        };
    }

    async findLastExam(
        userId: number,
        subjectId: number
    ) {
        try {
            const subject = await this.prismaService.subject.findUnique({ 
                where: { id: subjectId } 
            });

            if (!subject)
                throw new BadRequestException('Przedmiot nie został znaleziony');

            const userSubject = await this.prismaService.userSubject.findUnique({
                where: {
                    userId_subjectId: { userId, subjectId }
                },
                select: { threshold: true }
            });

            const threshold = userSubject?.threshold ?? 50;

            const lastExam = await this.prismaService.exam.findFirst({
                where: {
                    userId: userId,
                    subjectId: subjectId
                },
                orderBy: {
                    partId: 'asc'
                }
            });

            if (!lastExam) {
                return {
                    exam: null,
                    statusCode: 200,
                    message: 'Arkusz został pobrany'
                }
            }

            const exam = await this.buildExam(userId, subjectId, lastExam, subject, threshold);

            return {
                exam,
                statusCode: 200,
                message: 'Arkusz został pobrany'
            };
        } catch (error: any) {
            console.error('SQL Error in findLastExam:', error);
            throw new InternalServerErrorException(`Błąd: ${error.message}`);
        }
    }

    async findExams(
        userId: number,
        subjectId: number,
    ) {
        try {
            const subject = await this.prismaService.subject.findUnique({ 
                where: { id: subjectId } 
            });

            if (!subject)
                throw new BadRequestException('Przedmiot nie został znaleziony');

            const userSubject = await this.prismaService.userSubject.findUnique({
                where: {
                    userId_subjectId: { userId, subjectId }
                },
                select: { threshold: true }
            });

            const threshold = userSubject?.threshold ?? 50;

            const exams = await this.prismaService.exam.findMany({
                where: {
                    userId,
                    subjectId
                },
                orderBy: {
                    partId: 'desc'
                }
            });

            const enrichedExams = await Promise.all(
                exams.map(async (exam) =>
                    await this.buildExam(userId, subjectId, exam, subject, threshold)
                )
            );

            return {
                exams: enrichedExams,
                statusCode: 200,
                message: 'Arkusze zostały pobrane'
            };
        } catch (error: any) {
            console.error('SQL Error in findExams:', error);
            throw new InternalServerErrorException(`Błąd: ${error.message}`);
        }
    }

    async findExamById(
        userId: number,
        subjectId: number,
        examId: number
    ) {
        try {
            const subject = await this.prismaService.subject.findUnique({ 
                where: { id: subjectId } 
            });

            if (!subject)
                throw new BadRequestException('Przedmiot nie został znaleziony');

            const userSubject = await this.prismaService.userSubject.findUnique({
                where: {
                    userId_subjectId: { userId, subjectId }
                },
                select: { threshold: true }
            });

            const threshold = userSubject?.threshold ?? 50;

            const exam = await this.prismaService.exam.findFirst({
                where: {
                    userId: userId,
                    subjectId: subjectId,
                    id: examId
                }
            });

            if (!exam) {
                return {
                    exam: null,
                    statusCode: 200,
                    message: 'Arkusz został pobrany'
                }
            }

            const newExam = await this.buildExam(userId, subjectId, exam, subject, threshold);

            return {
                exam: newExam,
                statusCode: 200,
                message: 'Arkusz został pobrany'
            };
        } catch (error: any) {
            console.error('SQL Error in findExamById:', error);
            throw new InternalServerErrorException(`Błąd: ${error.message}`);
        }
    }

    async examAIGenerate(
        userId: number,
        subjectId: number,
        data: ExamAIGenerate,
        signal?: AbortSignal
    ) {
        const url = `${this.fastapiUrl}/admin/exam-generate`;

        try {
            const subject = await this.prismaService.subject.findUnique({ where: { id: subjectId } });

            if (!subject)
                throw new BadRequestException('Przedmiot nie został znaleziony');

            const userSubject = await this.prismaService.userSubject.findUnique({
                where: { userId_subjectId: { userId, subjectId } },
                select: { threshold: true, detailLevel: true }
            });

            const threshold = userSubject?.threshold ?? 50;
            const detailLevel = userSubject?.detailLevel ?? 'BASIC';

            const getTopicDifficulties = (level: SubjectDetailLevel): string[] => {
                switch (level) {
                    case 'BASIC': return ['Podstawowy'];
                    case 'EXPANDED': return ['Podstawowy', 'Rozszerzony'];
                    default: return ['Podstawowy'];
                }
            };

            const topicDifficulties = getTopicDifficulties(detailLevel);

            const result = await this.prismaService.$queryRaw<any[]>`
                WITH subtopics_base AS (
                    SELECT 
                        st.id,
                        st."topicId",
                        st."partId",
                        st."detailLevel",
                        COALESCE(ust.percent, 0) AS percent,
                        st.importance AS importance
                    FROM "Subtopic" st
                    LEFT JOIN "UserSubtopic" ust
                        ON ust."subtopicId" = st.id
                        AND ust."userId" = ${userId}
                        AND ust."subjectId" = ${subjectId}
                    WHERE st."subjectId" = ${subjectId}
                    AND st."detailLevel"::text = ANY(
                            CASE ${detailLevel}::text
                                WHEN 'EXPANDED' THEN ARRAY['BASIC','EXPANDED']::text[]
                                ELSE ARRAY['BASIC']::text[]
                            END
                        )
                    AND EXISTS (
                        SELECT 1 FROM "Topic" t
                        WHERE t.id = st."topicId"
                        AND t."difficulty" = ANY(${topicDifficulties}::text[])
                    )
                ),

                filtered_subtopics AS (
                    SELECT *
                    FROM subtopics_base
                    WHERE percent < ${threshold}
                ),

                fallback_subtopics AS (
                    SELECT *
                    FROM subtopics_base sb
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM filtered_subtopics fs
                        WHERE fs."topicId" = sb."topicId"
                    )
                ),

                combined_subtopics AS (
                    SELECT * FROM filtered_subtopics
                    UNION ALL
                    SELECT * FROM fallback_subtopics
                ),

                ranked_subtopics AS (
                    SELECT
                        cs.*,
                        ROW_NUMBER() OVER (
                            PARTITION BY cs."topicId"
                            ORDER BY cs."partId" ASC
                        ) AS rn
                    FROM combined_subtopics cs
                ),

                final_subtopics AS (
                    SELECT *
                    FROM ranked_subtopics
                    WHERE rn <= 3
                ),

                subtopics_calc AS (
                    SELECT 
                        st."topicId",
                        ROUND(
                            SUM(
                                CASE 
                                    WHEN st."detailLevel" = 'BASIC' THEN 240
                                    WHEN st."detailLevel" = 'EXPANDED' THEN 360
                                    ELSE 240
                                END
                                * (st.importance / 100.0)
                                * ((100 - st.percent) / 100.0)
                            )
                        )::int AS sub_time,
                        COUNT(*) AS sub_count
                    FROM final_subtopics st
                    GROUP BY st."topicId"
                ),

                topics_base AS (
                    SELECT
                        t.id,
                        t."partId",
                        t.name,
                        t.frequency AS frequency,
                        COALESCE(ut.percent, 0)::int AS percent,
                        COALESCE(NULLIF(t.type, ''), 'General') AS type
                    FROM "Topic" t
                    LEFT JOIN "UserTopic" ut
                        ON ut."topicId" = t.id
                        AND ut."userId" = ${userId}
                        AND ut."subjectId" = ${subjectId}
                    WHERE t."subjectId" = ${subjectId}
                    AND t."difficulty" = ANY(${topicDifficulties}::text[])
                )

                SELECT
                    tb.id,
                    tb.name,
                    tb.frequency,
                    tb.percent,
                    tb.type,
                    CASE 
                        WHEN tb.type = 'Writing' THEN 5400
                        WHEN tb.type = 'Stories' THEN 600
                        ELSE COALESCE(sc.sub_time, 0)
                    END::int AS time
                FROM topics_base tb
                LEFT JOIN subtopics_calc sc
                    ON sc."topicId" = tb.id
                WHERE 
                    tb.type IN ('Writing', 'Stories')
                    OR sc.sub_count > 0
                ORDER BY tb.frequency DESC;
            `;

            data.subject = data.subject ?? subject.name;
            data.examTemplates = data.examTemplates ?? subject.examTemplates;
            data.totalTimeSpentSeconds = data.totalTimeSpentSeconds ?? subject.totalTimeSpent * 60;
            data.topics = data.topics ?? result;

            data.prompt = subject.examPrompt ?? "";

            if (!Array.isArray(data.outputTopics) || !data.outputTopics.every(item => typeof item === 'number')) {
                throw new BadRequestException('Topics musi być listą liczb');
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
                !Array.isArray(r.outputTopics) ||
                !Array.isArray(r.errors) ||
                typeof r.attempt !== 'number'
            ) {
                throw new BadRequestException('Niepoprawna struktura odpowiedzi z serwera.');
            }

            return {
                statusCode: 201,
                message: "Generacja arkusza przedmiotu udana",
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

    async createExamTransaction(
        userId: number,
        subjectId: number,
        examData: ExamCreateRequest
    ) {
        try {
            return await this.prismaService.$transaction(async (tx) => {
                const lastExam = await tx.exam.findFirst({
                    where: {
                        userId: userId,
                        subjectId: subjectId
                    },
                    orderBy: {
                        partId: 'desc'
                    }
                });

                const newPartId = lastExam ? lastExam.partId + 1 : 1;

                const newExam = await tx.exam.create({
                    data: {
                        userId: userId,
                        subjectId: subjectId,
                        partId: newPartId,
                    }
                });

                const examTopics = examData.topics.map((topicId, index) => ({
                    examId: newExam.id,
                    topicId: topicId,
                    partId: index + 1,
                }));

                await tx.examTopic.createMany({
                    data: examTopics
                });

                await tx.task.updateMany({
                    where: {
                        examId: {
                            not: null
                        },
                        finished: false
                    },
                    data: {
                        examId: newExam.id
                    }
                });

                return {
                    exam: newExam,
                    statusCode: 200,
                    message: 'Arkusz został stworzony'
                };
            }, { timeout: 900000 });
        } catch (error) {
            console.log(error);
            throw new InternalServerErrorException(`Nie udało się zapisać arkusz: ${error}`);
        }
    }
}