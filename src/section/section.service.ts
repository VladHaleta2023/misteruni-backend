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
        items: Array<{ percent: number; importance?: number; isSubtopic?: boolean }>,
        dailyStudyMinutes: number,
        userId: number,
        subjectId: number
    ) {
        try {
            const pendingItems = items
                .map(item => {
                    const remainingToThreshold = Math.max(0, threshold - item.percent);
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
                    date: `${String(local.getDate()).padStart(2,'0')}.${String(local.getMonth()+1).padStart(2,'0')}.${local.getFullYear()}`,
                    daysNeeded: 0
                }
            }

            let totalTimeMinutes = 0;

            for (const item of pendingItems) {

                let baseTimeMinutes = 0;

                if (item.isSubtopic) {
                    const importance = item.importance ?? 100;
                    baseTimeMinutes = 20 * (importance / 100);
                } else {
                    baseTimeMinutes = 3;
                }

                const fractionOfFull = item.remainingToThreshold / 100;

                const time = baseTimeMinutes * fractionOfFull;

                totalTimeMinutes += time;
            }

            const daysNeeded = totalTimeMinutes / dailyStudyMinutes;

            const predictionDate = new Date(
                now.getTime() + daysNeeded * 24 * 60 * 60 * 1000
            );

            const local = this.timezoneService.utcToLocal(predictionDate);

            return {
                date: `${String(local.getDate()).padStart(2,'0')}.${String(local.getMonth()+1).padStart(2,'0')}.${local.getFullYear()}`,
                daysNeeded
            }
        } catch (error) {
            console.error('Error in calculatePrediction:', error);
            const local = this.timezoneService.utcToLocal(now);
            return {
                date: `${String(local.getDate()).padStart(2,'0')}.${String(local.getMonth()+1).padStart(2,'0')}.${local.getFullYear()}`,
                daysNeeded: 0
            };
        }
    }

    private getDaysDifference(dateStr1: string, dateStr2: string): number {
        const parseDate = (dateStr: string): number => {
            const [day, month, year] = dateStr.split('.').map(Number);
            return Date.UTC(year, month - 1, day);
        };

        const utc1 = parseDate(dateStr1);
        const utc2 = parseDate(dateStr2);
        
        const diffDays = (utc1 - utc2) / (1000 * 60 * 60 * 24);
        
        return diffDays;
    }

    private async getPredictionSubtopics(userId: number, subjectId: number, detailLevels: string[]) {
        return this.prismaService.$queryRaw<any[]>`
            SELECT 
                st.id,
                st.name,
                st.importance,
                st."topicId",
                st."sectionId",
                COALESCE(ust.percent, 0) as percent
            FROM "Subtopic" st
            LEFT JOIN "UserSubtopic" ust ON ust."subtopicId" = st.id 
                AND ust."userId" = ${userId}
            WHERE st."subjectId" = ${subjectId}
                AND st."detailLevel" = ANY(${detailLevels}::"SubjectDetailLevel"[])
            ORDER BY st.importance DESC;
        `;
    }

    private async getSectionsWithTopics(subjectId: number) {
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
            LEFT JOIN "Topic" t ON t."sectionId" = s.id
            WHERE s."subjectId" = ${subjectId}
            ORDER BY s."partId" ASC, t."partId" ASC;
        `;
    }

    private async getCurrentPercents(userId: number, subjectId: number) {
        return this.prismaService.$queryRaw<any[]>`
            SELECT 
                ut."topicId",
                ut.percent as "topicPercent",
                ut."sectionId",
                us.percent as "sectionPercent"
            FROM "UserTopic" ut
            INNER JOIN "UserSection" us ON us."sectionId" = ut."sectionId" 
                AND us."userId" = ut."userId" 
                AND us."subjectId" = ut."subjectId"
            WHERE ut."userId" = ${userId}
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

    async findSections(userId: number, subjectId: number) {
        try {
            const [subject, userSubject] = await Promise.all([
                this.prismaService.subject.findUnique({ where: { id: subjectId } }),
                this.prismaService.userSubject.findUnique({
                    where: { userId_subjectId: { userId, subjectId } },
                    select: { threshold: true, detailLevel: true, dailyStudyMinutes: true }
                })
            ]);

            if (!subject) throw new BadRequestException('Przedmiot nie został znaleziony');

            const threshold = userSubject?.threshold ?? 50;
            const detailLevel = userSubject?.detailLevel ?? 'BASIC';
            const dailyStudyMinutes = userSubject?.dailyStudyMinutes ?? 120;
            const detailLevels = this.getDetailLevels(detailLevel);

            const [predictionSubtopics, sectionsWithTopics, currentPercents, words, literatures, firstTask] = await Promise.all([
                this.getPredictionSubtopics(userId, subjectId, detailLevels),
                this.getSectionsWithTopics(subjectId),
                this.getCurrentPercents(userId, subjectId),
                this.getWordsWithProgress(userId, subjectId),
                this.getLiteratureNames(subjectId),
                this.getFirstFinishedTask(userId, subjectId)
            ]);

            const subtopicsByTopic = new Map<number, any[]>();
            predictionSubtopics.forEach(subtopic => {
                if (!subtopicsByTopic.has(subtopic.topicId)) {
                    subtopicsByTopic.set(subtopic.topicId, []);
                }
                subtopicsByTopic.get(subtopic.topicId)!.push({
                    id: subtopic.id,
                    name: subtopic.name,
                    percent: subtopic.percent,
                    status: this.getStatus(subtopic.percent, threshold)
                });
            });

            const topicPercentMap = new Map<number, number>();
            const sectionPercentMap = new Map<number, number>();
            const topicImportanceMap = new Map<number, number>();
            const topicCurrentPercentMap = new Map<number, number>();

            predictionSubtopics.forEach(subtopic => {
                const currentSum = topicImportanceMap.get(subtopic.topicId) || 0;
                topicImportanceMap.set(subtopic.topicId, currentSum + (subtopic.importance || 0));
            });
            
            for (const row of currentPercents) {
                topicPercentMap.set(row.topicId, row.topicPercent);
                sectionPercentMap.set(row.sectionId, row.sectionPercent);
                topicCurrentPercentMap.set(row.topicId, row.topicPercent);
            }

            const topicItems = Array.from(topicImportanceMap.keys()).map(topicId => {
                const totalImportance = topicImportanceMap.get(topicId) || 0;
                const currentPercent = topicCurrentPercentMap.get(topicId) || 0;
                
                return {
                    percent: currentPercent,
                    importance: totalImportance,
                    isSubtopic: true
                };
            });

            const pendingTopics = topicItems.filter(topic => topic.percent < threshold);

            const pendingWords = words
                .map(w => {
                    const percent = w.totalAttemptCount === 0 ? 0 : Math.ceil((w.totalCorrectCount * 100) / w.totalAttemptCount);
                    return { percent, importance: 100 - w.frequency };
                })
                .filter(w => w.percent < threshold);

            const predictionItems = [
                ...pendingTopics,
                ...pendingWords.map(w => ({
                    percent: w.percent,
                    importance: w.importance ?? 0,
                    isSubtopic: false
                }))
            ];

            const sectionMap = new Map<number, any>();
            
            for (const row of sectionsWithTopics) {
                let section = sectionMap.get(row.sectionId);
                if (!section) {
                    section = {
                        id: row.sectionId,
                        name: row.sectionName,
                        type: row.sectionType,
                        percent: sectionPercentMap.get(row.sectionId) || 0,
                        status: this.getStatus(sectionPercentMap.get(row.sectionId) || 0, threshold),
                        topics: [],
                    };
                    sectionMap.set(row.sectionId, section);
                }

                if (row.topicId) {
                    const topicPercent = topicPercentMap.get(row.topicId) || 0;
                    const topicStatus = this.getStatus(topicPercent, threshold);
                    const isUncompleted = topicStatus !== 'completed';

                    const topicSubtopics = subtopicsByTopic.get(row.topicId) || [];

                    const topic = {
                        id: row.topicId,
                        name: row.topicName,
                        type: row.topicType,
                        percent: topicPercent,
                        frequency: row.topicFrequency || 0,
                        status: topicStatus,
                        subtopics: topicSubtopics
                    };
                    section.topics.push(topic);
                }
            }

            const enrichedSections = Array.from(sectionMap.values());
            const totalPercent = this.calculateTotalPercent(enrichedSections);

            const initialNow = firstTask?.updatedAt ?? new Date();

            const initialTopicItems = Array.from(topicImportanceMap.keys()).map(topicId => {
                const totalImportance = topicImportanceMap.get(topicId) || 0;
                
                return {
                    percent: 0,
                    importance: totalImportance,
                    isSubtopic: true
                };
            });

            const initialItems = [
                ...initialTopicItems,
                ...pendingWords.map(w => ({
                    percent: 0,
                    importance: w.importance ?? 0,
                    isSubtopic: false
                }))
            ];

            const [initialPrediction, prediction] = await Promise.all([
                this.calculatePrediction(initialNow, threshold, initialItems, dailyStudyMinutes, userId, subjectId),
                this.calculatePrediction(new Date(), threshold, predictionItems, dailyStudyMinutes, userId, subjectId)
            ]);

            let deltaDays: number | null = null;
            if (firstTask)
                deltaDays = this.getDaysDifference(initialPrediction.date, prediction.date);

            return {
                statusCode: 200,
                message: 'Działy zostały pomyślnie pobrane',
                sections: enrichedSections,
                total: totalPercent,
                prediction: prediction.date,
                deltaDays,
                subjectId,
                literatures: literatures.map(lit => lit.name)
            };
        } catch (error) {
            console.error(error);
            throw new InternalServerErrorException('Nie udało się pobrać działów');
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

    private calculateTotalPercent(sectionsWithStatus: any[]) {
        if (sectionsWithStatus.length === 0) {
            return { started: 100, progress: 0, completed: 0 };
        }

        let sumCompleted = 0;
        let sumProgress = 0;

        for (const section of sectionsWithStatus) {
            const p = Math.min(100, section.percent ?? 0);
            if (section.status === "completed") sumCompleted += p;
            else if (section.status === "progress") sumProgress += p;
        }

        const maxPercent = sectionsWithStatus.length * 100;
        const percentCompleted = Math.ceil((sumCompleted / maxPercent) * 100);
        const percentProgress = Math.ceil((sumProgress / maxPercent) * 100);
        const percentStarted = 100 - percentCompleted - percentProgress;

        return { started: percentStarted, progress: percentProgress, completed: percentCompleted };
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

            const solutionGuidePromptOwn = Boolean(section.solutionGuidePrompt && section.solutionGuidePrompt.trim() !== "");
            const vocabularyGuidePromptOwn = Boolean(section.vocabularyGuidePrompt && section.vocabularyGuidePrompt.trim() !== "");
            const subtopicsPromptOwn = Boolean(section.subtopicsPrompt && section.subtopicsPrompt.trim() !== "");
            const subtopicsStatusPromptOwn = Boolean(section.subtopicsStatusPrompt && section.subtopicsStatusPrompt.trim() !== "");
            const questionPromptOwn = Boolean(section.questionPrompt && section.questionPrompt.trim() !== "");
            const answersPromptOwn = Boolean(section.answersPrompt && section.answersPrompt.trim() !== "");
            const closedSubtopicsPromptOwn = Boolean(section.closedSubtopicsPrompt && section.closedSubtopicsPrompt.trim() !== "");
            const vocabluaryPromptOwn = Boolean(section.vocabluaryPrompt && section.vocabluaryPrompt.trim() !== "");
            const wordsPromptOwn = Boolean(section.wordsPrompt && section.wordsPrompt.trim() !== "");
            const chatPromptOwn = Boolean(section.chatPrompt && section.chatPrompt.trim() !== "");
            const topicExpansionPromptOwn = Boolean(section.topicExpansionPrompt && section.topicExpansionPrompt.trim() !== "");
            const topicFrequencyPromptOwn = Boolean(section.topicFrequencyPrompt && section.topicFrequencyPrompt.trim() !== "");
            const chronologyPromptOwn = Boolean(section.chronologyPrompt && section.chronologyPrompt.trim() !== "");
            const literaturePromptOwn = Boolean(section.literaturePrompt && section.literaturePrompt.trim() !== "");

            const prompts = {
                vocabularyGuidePrompt: vocabularyGuidePromptOwn ? section.vocabularyGuidePrompt.trim() : (subject.vocabularyGuidePrompt || ""),
                vocabularyGuidePromptOwn: vocabularyGuidePromptOwn,

                solutionGuidePrompt: solutionGuidePromptOwn ? section.solutionGuidePrompt.trim() : (subject.solutionGuidePrompt || ""),
                solutionGuidePromptOwn: solutionGuidePromptOwn,

                literaturePrompt: literaturePromptOwn ? section.literaturePrompt.trim() : (subject.literaturePrompt || ""),
                literaturePromptOwn: literaturePromptOwn,

                topicExpansionPrompt: topicExpansionPromptOwn ? section.topicExpansionPrompt.trim() : (subject.topicExpansionPrompt || ""),
                topicExpansionPromptOwn: topicExpansionPromptOwn,

                topicFrequencyPrompt: topicFrequencyPromptOwn ? section.topicFrequencyPrompt.trim() : (subject.topicFrequencyPrompt || ""),
                topicFrequencyPromptOwn: topicFrequencyPromptOwn,

                chronologyPrompt: chronologyPromptOwn ? section.chronologyPrompt.trim() : (subject.chronologyPrompt || ""),
                chronologyPromptOwn: chronologyPromptOwn,

                subtopicsPrompt: subtopicsPromptOwn ? section.subtopicsPrompt.trim() : (subject.subtopicsPrompt || ""),
                subtopicsPromptOwn: subtopicsPromptOwn,

                subtopicsStatusPrompt: subtopicsStatusPromptOwn ? section.subtopicsStatusPrompt.trim() : (subject.subtopicsStatusPrompt || ""),
                subtopicsStatusPromptOwn: subtopicsStatusPromptOwn,

                questionPrompt: questionPromptOwn ? section.questionPrompt.trim() : (subject.questionPrompt || ""),
                questionPromptOwn: questionPromptOwn,

                answersPrompt: answersPromptOwn ? section.answersPrompt.trim() : (subject.answersPrompt || ""),
                answersPromptOwn: answersPromptOwn,

                closedSubtopicsPrompt: closedSubtopicsPromptOwn ? section.closedSubtopicsPrompt.trim() : (subject.closedSubtopicsPrompt || ""),
                closedSubtopicsPromptOwn: closedSubtopicsPromptOwn,

                vocabluaryPrompt: vocabluaryPromptOwn ? section.vocabluaryPrompt.trim() : (subject.vocabluaryPrompt || ""),
                vocabluaryPromptOwn: vocabluaryPromptOwn,

                wordsPrompt: wordsPromptOwn ? section.wordsPrompt.trim() : (subject.wordsPrompt || ""),
                wordsPromptOwn: wordsPromptOwn,

                chatAnswerPrompt: chatPromptOwn ? section.chatPrompt.trim() : (subject.chatPrompt || ""),
                chatPromptOwn: chatPromptOwn,
            };

            const enrichedSection: any = {
                ...section,
                ...prompts,
            };

            const response: any = {
                statusCode: 200,
                message: 'Dział został pomyślnie pobrany',
                section: enrichedSection,
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