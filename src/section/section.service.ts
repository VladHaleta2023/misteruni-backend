import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SectionUpdateRequest } from '../section/dto/section-request.dto';
import { TimezoneService } from '../timezone/timezone.service';
import { SubjectDetailLevel } from '@prisma/client';

@Injectable()
export class SectionService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly timezoneService: TimezoneService
    ) {}

    async calculatePrediction(
        now: Date,
        threshold: number,
        items: Array<{
            percent: number;
            importance?: number;
            isSubtopic?: boolean;
            isWriting?: boolean;
            detailLevel?: SubjectDetailLevel;
        }>,
        dailyStudyMinutes: number,
        userId: number,
        subjectId: number
    ) {
        try {

            const pendingItems = items
                .map(item => {
                    const remainingToThreshold = Math.max(
                        0,
                        threshold - item.percent
                    );

                    return {
                        ...item,
                        importance: item.importance ?? 0,
                        remainingToThreshold
                    };
                })
                .filter(item => item.remainingToThreshold > 0);

            if (!pendingItems.length || dailyStudyMinutes <= 0) {
                const local = this.timezoneService.utcToLocal(now);

                return {
                    date: `${String(local.getDate()).padStart(2, '0')}.${String(local.getMonth() + 1).padStart(2, '0')}.${local.getFullYear()}`,
                    daysNeeded: 0
                };
            }

            let totalTimeSeconds = 0;

            for (const item of pendingItems) {

                let baseTimeSeconds = 0;

                if (item.isWriting) {
                    baseTimeSeconds = 3600;
                }
                else if (item.isSubtopic) {
                    let initialTimeSeconds = 1200;

                    switch (item.detailLevel) {
                        case SubjectDetailLevel.BASIC:
                            initialTimeSeconds = 1200;
                            break;
                        case SubjectDetailLevel.EXPANDED:
                            initialTimeSeconds = 1500;
                            break;
                        default:
                            initialTimeSeconds = 1200;
                    }

                    const importance = item.importance ?? 100;
                    baseTimeSeconds = initialTimeSeconds * (importance / 100);
                }
                else {
                    baseTimeSeconds = 600;
                }

                const fractionOfFull =
                    item.remainingToThreshold / 100;

                const time =
                    baseTimeSeconds * fractionOfFull;

                totalTimeSeconds += time;
            }

            const daysNeeded =
                totalTimeSeconds / (dailyStudyMinutes * 60);

            const predictionDate = new Date(
                now.getTime() +
                daysNeeded * 24 * 60 * 60 * 1000
            );

            const local =
                this.timezoneService.utcToLocal(predictionDate);

            return {
                date: `${String(local.getDate()).padStart(2, '0')}.${String(local.getMonth() + 1).padStart(2, '0')}.${local.getFullYear()}`,
                daysNeeded
            };

        } catch (error) {
            console.error(
                'Error in calculatePrediction:',
                error
            );

            const local =
                this.timezoneService.utcToLocal(now);

            return {
                date: `${String(local.getDate()).padStart(2, '0')}.${String(local.getMonth() + 1).padStart(2, '0')}.${local.getFullYear()}`,
                daysNeeded: 0
            };
        }
    }

    private getDaysDifference(
        dateStr1: string,
        dateStr2: string
    ): number {

        const parseDate = (dateStr: string): number => {

            const [day, month, year] =
                dateStr.split('.').map(Number);

            return Date.UTC(year, month - 1, day);
        };

        const utc1 = parseDate(dateStr1);
        const utc2 = parseDate(dateStr2);

        const diffDays =
            (utc1 - utc2) / (1000 * 60 * 60 * 24);

        return diffDays;
    }

    private async getPredictionSubtopics(
        userId: number,
        subjectId: number,
        detailLevels: string[],
        topicDifficulties: string[]
    ) {
        return this.prismaService.$queryRaw<any[]>`
            SELECT 
                st.id,
                st.name,
                st.importance,
                st."topicId",
                st."detailLevel",
                st."sectionId",
                COALESCE(ust.percent, 0) as percent
            FROM "Subtopic" st
            LEFT JOIN "UserSubtopic" ust 
                ON ust."subtopicId" = st.id 
                AND ust."userId" = ${userId}
            WHERE 
                st."subjectId" = ${subjectId}
                AND st."detailLevel" = ANY(${detailLevels}::"SubjectDetailLevel"[])
                AND EXISTS (
                    SELECT 1 FROM "Topic" t 
                    WHERE t.id = st."topicId" 
                    AND t."difficulty" = ANY(${topicDifficulties}::text[])
                )
            ORDER BY st.importance DESC;
        `;
    }

    private getTopicDifficulties(userDetailLevel: SubjectDetailLevel): string[] {
        switch (userDetailLevel) {
            case 'BASIC': return ['Podstawowy'];
            case 'EXPANDED': return ['Podstawowy', 'Rozszerzony'];
            default: return ['Podstawowy'];
        }
    }

    private async getSectionsWithTopics(
        subjectId: number,
        topicDifficulties: string[]
    ) {
        return this.prismaService.$queryRaw<any[]>`
            SELECT 
                s.id AS "sectionId",
                s.name AS "sectionName",
                s.type AS "sectionType",
                s."partId" AS "sectionPartId",
                t.id AS "topicId",
                t.name AS "topicName",
                t.type AS "topicType",
                t."partId" AS "topicPartId",
                t."frequency" AS "topicFrequency"
            FROM "Section" s
            LEFT JOIN "Topic" t 
                ON t."sectionId" = s.id
                AND t."difficulty" = ANY(${topicDifficulties}::text[])
            WHERE 
                s."subjectId" = ${subjectId}
            ORDER BY s."partId" ASC, t."partId" ASC;
        `;
    }

    private async getCurrentPercents(
        userId: number,
        subjectId: number
    ) {

        return this.prismaService.$queryRaw<any[]>`
            SELECT 
                ut."topicId",
                ut.percent as "topicPercent",
                ut."sectionId",
                us.percent as "sectionPercent"

            FROM "UserTopic" ut

            INNER JOIN "UserSection" us 
                ON us."sectionId" = ut."sectionId" 
                AND us."userId" = ut."userId" 
                AND us."subjectId" = ut."subjectId"

            WHERE 
                ut."userId" = ${userId}
                AND ut."subjectId" = ${subjectId};
        `;
    }

    private async getWordsWithProgress(
        userId: number, 
        subjectId: number,
        topicDifficulties: string[]  // ДОБАВИТЬ параметр
    ) {
        return this.prismaService.$queryRaw<any[]>`
            SELECT 
                w.frequency, 
                w."totalAttemptCount", 
                w."totalCorrectCount",
                t."difficulty" as "topicDifficulty"
            FROM "Word" w
            INNER JOIN "Topic" t ON t.id = w."topicId"
            WHERE 
                w."userId" = ${userId} 
                AND w."subjectId" = ${subjectId}
                AND t."difficulty" = ANY(${topicDifficulties}::text[])
        `;
    }

    private async getLiteratureNames(subjectId: number) {
        return this.prismaService.literature.findMany({
            where: { subjectId },
            select: { name: true },
            orderBy: { name: 'asc' }
        });
    }

    private async getFirstFinishedTask(userId: number, subjectId: number) {
        return this.prismaService.task.findFirst({
            where: {
                userId,
                subjectId,
                finished: true
            },
            orderBy: {
                createdAt: 'asc'
            },
            select: {
                createdAt: true
            }
        });
    }

    async findSections(
        userId: number,
        subjectId: number
    ) {
        try {
            const [subject, userSubject] =
                await Promise.all([

                    this.prismaService.subject.findUnique({
                        where: { id: subjectId }
                    }),

                    this.prismaService.userSubject.findUnique({
                        where: {
                            userId_subjectId: {
                                userId,
                                subjectId
                            }
                        },
                        select: {
                            threshold: true,
                            detailLevel: true,
                            dailyStudyMinutes: true,
                            examDate: true
                        }
                    })
                ]);

            if (!subject)
                throw new BadRequestException(
                    'Przedmiot nie został znaleziony'
                );

            const examDate =
                userSubject?.examDate ?? Date.now();

            const threshold =
                userSubject?.threshold ?? 50;

            const detailLevel =
                userSubject?.detailLevel ?? 'BASIC';

            const dailyStudyMinutes =
                userSubject?.dailyStudyMinutes ?? 120;

            const detailLevels =
                this.getDetailLevels(detailLevel);

            const topicDifficulties = this.getTopicDifficulties(detailLevel);

            const [
                predictionSubtopics,
                sectionsWithTopics,
                currentPercents,
                words,
                literatures,
                firstTask
            ] = await Promise.all([

                this.getPredictionSubtopics(
                    userId,
                    subjectId,
                    detailLevels,
                    topicDifficulties
                ),

                this.getSectionsWithTopics(subjectId, topicDifficulties),

                this.getCurrentPercents(
                    userId,
                    subjectId
                ),

                this.getWordsWithProgress(
                    userId,
                    subjectId,
                    topicDifficulties
                ),

                this.getLiteratureNames(subjectId),

                this.getFirstFinishedTask(
                    userId,
                    subjectId
                )
            ]);

            const subtopicsByTopic =
                new Map<number, any[]>();

            predictionSubtopics.forEach(subtopic => {
                if (!subtopicsByTopic.has(subtopic.topicId)) {
                    subtopicsByTopic.set(
                        subtopic.topicId,
                        []
                    );
                }

                subtopicsByTopic
                    .get(subtopic.topicId)!
                    .push({
                        id: subtopic.id,
                        name: subtopic.name,
                        detailLevel: subtopic.detailLevel,
                        percent: subtopic.percent,
                        status: this.getStatus(
                            subtopic.percent,
                            threshold
                        )
                    });
            });

            const topicPercentMap =
                new Map<number, number>();

            const sectionPercentMap =
                new Map<number, number>();

            const topicImportanceMap =
                new Map<number, number>();

            const topicCurrentPercentMap =
                new Map<number, number>();

            predictionSubtopics.forEach(subtopic => {
                const currentSum =
                    topicImportanceMap.get(
                        subtopic.topicId
                    ) || 0;

                topicImportanceMap.set(
                    subtopic.topicId,
                    currentSum + (subtopic.importance || 0)
                );
            });

            for (const row of currentPercents) {
                topicPercentMap.set(
                    row.topicId,
                    row.topicPercent
                );

                sectionPercentMap.set(
                    row.sectionId,
                    row.sectionPercent
                );

                topicCurrentPercentMap.set(
                    row.topicId,
                    row.topicPercent
                );
            }

            const writingItems =
                sectionsWithTopics
                    .filter(
                        row => row.topicType === "Writing"
                    )
                    .map(row => ({
                        percent:
                            topicCurrentPercentMap.get(
                                row.topicId
                            ) || 0,
                        importance: 90,
                        isWriting: true
                    }));

            const pendingWords =
                words
                    .map(w => {
                        const percent =
                            w.totalAttemptCount === 0
                                ? 0
                                : Math.ceil(
                                    (w.totalCorrectCount * 100)
                                    / w.totalAttemptCount
                                );

                        return {
                            percent,
                            importance: 100 - w.frequency
                        };
                    })
                    .filter(w => w.percent < threshold);

            const allWords =
                words.map(w => {
                    const percent =
                        w.totalAttemptCount === 0
                            ? 0
                            : Math.ceil(
                                (w.totalCorrectCount * 100)
                                / w.totalAttemptCount
                            );

                    return {
                        percent,
                        importance: 100 - w.frequency
                    };
                });

            const pendingSubtopicItems = predictionSubtopics
                .filter(subtopic => {
                    const topicPercent = topicPercentMap.get(subtopic.topicId) ?? 0;
                    return topicPercent < threshold;
                })
                .map(subtopic => ({
                    percent: subtopic.percent,
                    importance: subtopic.importance ?? 0,
                    isSubtopic: true,
                    detailLevel: subtopic.detailLevel as SubjectDetailLevel
                }));

            const predictionItems = [
                ...pendingSubtopicItems,
                ...writingItems,
                ...pendingWords.map(w => ({
                    percent: w.percent,
                    importance: w.importance ?? 0,
                    isSubtopic: false
                }))
            ];

            const sectionMap =
                new Map<number, any>();

            for (const row of sectionsWithTopics) {
                let section =
                    sectionMap.get(row.sectionId);

                if (!section) {
                    section = {
                        id: row.sectionId,
                        name: row.sectionName,
                        type: row.sectionType,
                        percent:
                            sectionPercentMap.get(
                                row.sectionId
                            ) || 0,

                        status: this.getStatus(
                            sectionPercentMap.get(
                                row.sectionId
                            ) || 0,
                            threshold
                        ),

                        topics: []
                    };

                    sectionMap.set(
                        row.sectionId,
                        section
                    );
                }

                if (row.topicId) {
                    const topicPercent =
                        topicPercentMap.get(
                            row.topicId
                        ) || 0;

                    const topicStatus =
                        this.getStatus(
                            topicPercent,
                            threshold
                        );

                    const topicSubtopics =
                        subtopicsByTopic.get(
                            row.topicId
                        ) || [];

                    const topic = {
                        id: row.topicId,
                        name: row.topicName,
                        type: row.topicType,
                        percent: topicPercent,
                        frequency:
                            row.topicFrequency || 0,
                        status: topicStatus,
                        subtopics: topicSubtopics,
                        partId: row.topicPartId
                    };

                    section.topics.push(topic);
                }
            }

            for (const section of sectionMap.values()) {
                section.topics.sort((a, b) => {
                    const getTypePriority = (type: string) => {
                        if (type === 'Stories') return 1;
                        if (type === 'Writing') return 2;
                        return 0;
                    };
                    const priorityA = getTypePriority(a.type);
                    const priorityB = getTypePriority(b.type);
                    if (priorityA !== priorityB) return priorityA - priorityB;
                    return (a.partId || 0) - (b.partId || 0);
                });
            }

            const enrichedSections = Array.from(sectionMap.values())
                .map(section => {
                    const filteredTopics =
                        section.topics.filter(topic => {
                            if (
                                topic.type === 'Stories' ||
                                topic.type === 'Writing'
                            ) {
                                return true;
                            }
                            return topic.subtopics.length > 0;
                        });

                    return {
                        ...section,
                        topics: filteredTopics
                    };
                })
                .filter(section => section.topics.length > 0);

            const initialNow =
                firstTask?.createdAt ?? new Date();

            const initialSubtopicItems = predictionSubtopics
                .map(subtopic => ({
                    percent: 0,
                    importance: subtopic.importance ?? 0,
                    isSubtopic: true,
                    detailLevel: subtopic.detailLevel as SubjectDetailLevel
                }));

            const initialWritingItems =
                writingItems.map(item => ({
                    ...item,
                    percent: 0
                }));

            const initialItems = [
                ...initialSubtopicItems,
                ...initialWritingItems,
                ...allWords.map(w => ({
                    percent: 0,
                    importance: w.importance ?? 0,
                    isSubtopic: false
                }))
            ];

            const [
                initialPrediction,
                prediction
            ] = await Promise.all([

                this.calculatePrediction(
                    initialNow,
                    threshold,
                    initialItems,
                    dailyStudyMinutes,
                    userId,
                    subjectId
                ),

                this.calculatePrediction(
                    new Date(),
                    threshold,
                    predictionItems,
                    dailyStudyMinutes,
                    userId,
                    subjectId
                )
            ]);

            let deltaDays: number | null = null;

            if (firstTask) {
                deltaDays =
                    this.getDaysDifference(
                        initialPrediction.date,
                        prediction.date
                    );
            }

            const totalPercent = this.calculateTotalPercent(
                enrichedSections,
                new Date(examDate),
                prediction.daysNeeded
            );

            return {
                statusCode: 200,
                message: 'Działy zostały pomyślnie pobrane',
                sections: enrichedSections,
                total: totalPercent,
                prediction: prediction.date,
                deltaDays,
                subjectId,
                subjectUrl: subject.url,
                literatures: literatures.map(
                    lit => lit.name
                )
            };

        } catch (error) {

            console.error(error);

            throw new InternalServerErrorException(
                'Nie udało się pobrać działów'
            );
        }
    }

    private getDetailLevels(userDetailLevel: string): string[] {
        switch (userDetailLevel) {
            case 'BASIC': return ['BASIC'];
            case 'EXPANDED': return ['BASIC', 'EXPANDED'];
            default: return ['BASIC'];
        }
    }

    private getStatus(percent: number, userThreshold: number): string {
        if (percent === 0) return "started";
        if (percent >= userThreshold) return "completed";
        return "progress";
    }

    private calculateTotalPercent(
        sectionsWithStatus: any[],
        examDate: Date,
        predictionDaysNeeded: number
    ) {
        if (sectionsWithStatus.length === 0) {
            return {
                completed: 0,
                progress: 0,
                started: 100,
                willNotFinish: 0
            };
        }

        let completedCount = 0;
        let progressCount = 0;
        let startedCount = 0;

        for (const section of sectionsWithStatus) {
            if (section.status === "completed") {
                completedCount++;
            } else if (section.status === "progress") {
                progressCount++;
            } else if (section.status === "started") {
                startedCount++;
            }
        }

        const total = sectionsWithStatus.length;
        
        const completedPercent = Math.ceil((completedCount / total) * 100);
        const progressPercent = Math.ceil((progressCount / total) * 100);
        const totalStartedPercent = Math.ceil((startedCount / total) * 100);
        
        let willNotFinishPercent = 0;
        
        const today = new Date();
        const daysToExam = Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (predictionDaysNeeded <= 0) {
            predictionDaysNeeded = 0.001;
        }
        
        if (daysToExam <= 0) {
            willNotFinishPercent = totalStartedPercent;
        }
        else if (predictionDaysNeeded > daysToExam) {
            const shortageRatio = (predictionDaysNeeded - daysToExam) / predictionDaysNeeded;
            willNotFinishPercent = Math.ceil(totalStartedPercent * shortageRatio);
            willNotFinishPercent = Math.min(willNotFinishPercent, totalStartedPercent);
        }
        
        willNotFinishPercent = Math.max(0, willNotFinishPercent);
        
        const startedPercent = totalStartedPercent - willNotFinishPercent;

        return {
            completed: completedPercent,
            progress: progressPercent,
            started: startedPercent,
            willNotFinish: willNotFinishPercent
        };
    }

    async findSectionById(
        subjectId: number,
        id: number,
        withSubject = true,
    ) {
        try {
            const subject = await this.prismaService.subject.findUnique({
                where: { id: subjectId },
            });

            if (!subject) {
                throw new BadRequestException('Przedmiot nie został znaleziony');
            }

            const section = await this.prismaService.section.findFirst({
                where: { subjectId, id },
            });

            if (!section) {
                throw new BadRequestException('Dział nie został znaleziony');
            }

            const response: any = {
                statusCode: 200,
                message: 'Dział został pomyślnie pobrany',
                section,
            };

            if (withSubject) {
                response.subject = subject;
            }

            return response;
        } catch (error) {
            console.error('Error in findSectionById:', error);
            throw new InternalServerErrorException('Nie udało się pobrać działu');
        }
    }

    async updateSection(
        subjectId: number,
        id: number,
        data: SectionUpdateRequest
    ) {
        try {
            const existingSubject = await this.prismaService.subject.findUnique({ where: { id: subjectId } });
            if (!existingSubject) {
                return {
                    statusCode: 404,
                    message: `Przedmiot nie został znaleziony`,
                };
            }

            const existingSection = await this.prismaService.section.findUnique({ where: { id } });
            if (!existingSection) {
                return {
                    statusCode: 404,
                    message: `Dział nie został znaleziony`,
                };
            }

            const filteredData = Object.fromEntries(
                Object.entries(data).filter(([_, value]) => value !== undefined)
            );

            const updatedSection = await this.prismaService.section.update({
                where: { id },
                data: filteredData
            });

            return {
                statusCode: 200,
                message: 'Dział został pomyślnie zaktualizowany',
                section: updatedSection,
            };
        }
        catch (error) {
            throw new InternalServerErrorException('Błąd podczas aktualizacji dział');
        }
    }
}