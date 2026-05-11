import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SectionUpdateRequest } from '../section/dto/section-request.dto';
import { TimezoneService } from '../timezone/timezone.service';

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

            let totalTimeMinutes = 0;

            for (const item of pendingItems) {

                let baseTimeMinutes = 0;

                // Writing topic = 2h
                if (item.isWriting) {

                    baseTimeMinutes = 120;

                }
                // Subtopics
                else if (item.isSubtopic) {

                    const importance = item.importance ?? 100;

                    baseTimeMinutes = 20 * (importance / 100);

                }
                // Words
                else {

                    baseTimeMinutes = 3;
                }

                const fractionOfFull =
                    item.remainingToThreshold / 100;

                const time =
                    baseTimeMinutes * fractionOfFull;

                totalTimeMinutes += time;
            }

            const daysNeeded =
                totalTimeMinutes / dailyStudyMinutes;

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

    private getWillNotFinishPercent(
        sections: any[],
        threshold: number,
        dailyStudyMinutes: number,
        examDate: Date
    ): number {
        const notStartedSections = sections.filter(s => s.status === "started");
        
        if (notStartedSections.length === 0) {
            return 0;
        }

        const sectionsWithTime = notStartedSections.map(section => {
            let totalTimeMinutes = 0;

            for (const topic of section.topics) {
                const remainingToThreshold = Math.max(0, threshold - topic.percent);
                if (remainingToThreshold <= 0) continue;

                if (topic.type === "Writing") {
                    totalTimeMinutes += 120 * (remainingToThreshold / 100);
                }
                else if (topic.subtopics && topic.subtopics.length > 0) {
                    const totalImportance = topic.subtopics.reduce(
                        (sum: number, st: any) => sum + (st.importance || 100),
                        0
                    );
                    const avgImportance = totalImportance / topic.subtopics.length;
                    totalTimeMinutes += 20 * (avgImportance / 100) * (remainingToThreshold / 100);
                }
                else {
                    totalTimeMinutes += 3 * (remainingToThreshold / 100);
                }
            }

            return {
                section,
                daysNeeded: totalTimeMinutes / dailyStudyMinutes
            };
        });

        sectionsWithTime.sort((a, b) => a.daysNeeded - b.daysNeeded);

        const today = new Date();
        const daysToExam = Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        let remainingDays = daysToExam;
        let willNotFinishCount = 0;

        for (const item of sectionsWithTime) {
            if (item.daysNeeded <= remainingDays) {
                remainingDays -= item.daysNeeded;
            } else {
                willNotFinishCount++;
            }
        }

        const willNotFinishPercent = (willNotFinishCount / sections.length) * 100;
        
        return Math.ceil(willNotFinishPercent);
    }

    private async getPredictionSubtopics(
        userId: number,
        subjectId: number,
        detailLevels: string[]
    ) {

        return this.prismaService.$queryRaw<any[]>`
            SELECT 
                st.id,
                st.name,
                st.importance,
                st."topicId",
                st."sectionId",
                COALESCE(ust.percent, 0) as percent

            FROM "Subtopic" st

            LEFT JOIN "UserSubtopic" ust 
                ON ust."subtopicId" = st.id 
                AND ust."userId" = ${userId}

            WHERE 
                st."subjectId" = ${subjectId}
                AND st."detailLevel" = ANY(${detailLevels}::"SubjectDetailLevel"[])

            ORDER BY st.importance DESC;
        `;
    }

    private async getSectionsWithTopics(
        subjectId: number
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

    private async getWordsWithProgress(userId: number, subjectId: number) {
        return this.prismaService.$queryRaw<any[]>`
            SELECT frequency, "totalAttemptCount", "totalCorrectCount"
            FROM "Word"
            WHERE "userId" = ${userId} AND "subjectId" = ${subjectId}
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
                updatedAt: 'asc'
            },
            select: {
                updatedAt: true
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
                    detailLevels
                ),

                this.getSectionsWithTopics(subjectId),

                this.getCurrentPercents(
                    userId,
                    subjectId
                ),

                this.getWordsWithProgress(
                    userId,
                    subjectId
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

            // SUBTOPIC PREDICTION
            const topicItems =
                Array.from(topicImportanceMap.keys())
                    .map(topicId => {

                        const totalImportance =
                            topicImportanceMap.get(topicId) || 0;

                        const currentPercent =
                            topicCurrentPercentMap.get(topicId) || 0;

                        return {
                            percent: currentPercent,
                            importance: totalImportance,
                            isSubtopic: true
                        };
                    });

            const pendingTopics =
                topicItems.filter(
                    topic => topic.percent < threshold
                );

            // WRITING TOPICS
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

                        importance: 120,

                        isWriting: true
                    }));

            // WORDS
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

            const predictionItems = [

                ...pendingTopics,

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
                        subtopics: topicSubtopics
                    };

                    section.topics.push(topic);
                }
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
                firstTask?.updatedAt ?? new Date();

            const initialTopicItems =
                Array.from(topicImportanceMap.keys())
                    .map(topicId => {

                        const totalImportance =
                            topicImportanceMap.get(topicId) || 0;

                        return {
                            percent: 0,
                            importance: totalImportance,
                            isSubtopic: true
                        };
                    });

            const initialWritingItems =
                writingItems.map(item => ({
                    ...item,
                    percent: 0
                }));

            const initialItems = [

                ...initialTopicItems,

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
            case 'ACADEMIC': return ['BASIC', 'EXPANDED', 'ACADEMIC'];
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