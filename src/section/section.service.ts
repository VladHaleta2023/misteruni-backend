import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SectionUpdateRequest } from '../section/dto/section-request.dto';
import { TimezoneService } from '../timezone/timezone.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class SectionService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly timezoneService: TimezoneService
    ) {}

    async calculatePrediction(
        threshold: number, 
        subtopicsNow: any[],
        dailyStudyMinutes: number
    ) {
        try {
            const now = new Date();
            
            const pendingSubtopics = subtopicsNow.filter(subtopic => subtopic.percent < threshold);

            if (!pendingSubtopics.length) {
                const result = new Date(now);
                const local = this.timezoneService.utcToLocal(result);
                return `${String(local.getDate()).padStart(2,'0')}.${String(local.getMonth()+1).padStart(2,'0')}.${local.getFullYear()}`;
            }

            let totalTimeMinutes = 0;
            const baseTime = 20; // базовое время на подтему в минутах

            for (const subtopic of pendingSubtopics) {
                const difficultyCoefficient = (subtopic.importance || 0) / 100; // переводим проценты в коэффициент 0..1
                const remainingPercent = threshold - subtopic.percent; // сколько осталось до порога
                const subtopicTime = baseTime * difficultyCoefficient * (remainingPercent / 100);

                totalTimeMinutes += subtopicTime;
            }

            const daysNeeded = totalTimeMinutes > 0 ? totalTimeMinutes / dailyStudyMinutes : 0;

            const predictionDate = new Date(now.getTime() + daysNeeded * 24 * 60 * 60 * 1000);
            const local = this.timezoneService.utcToLocal(predictionDate);

            return `${String(local.getDate()).padStart(2,'0')}.${String(local.getMonth()+1).padStart(2,'0')}.${local.getFullYear()}`;
        } catch {
            return 'Infinity';
        }
    }

    async findSections(userId: number, subjectId: number) {
        try {
            const [subject, userSubject] = await Promise.all([
                this.prismaService.subject.findUnique({
                    where: { id: subjectId }
                }),
                this.prismaService.userSubject.findUnique({
                    where: { userId_subjectId: { userId, subjectId } },
                    select: { threshold: true, detailLevel: true, dailyStudyMinutes: true }
                })
            ]);
            
            if (!subject) throw new BadRequestException('Przedmiot nie został znaleziony');
            
            const threshold = userSubject?.threshold ?? 50;
            const detailLevel = userSubject?.detailLevel ?? 'MANDATORY';
            const dailyStudyMinutes = userSubject?.dailyStudyMinutes ?? 120;

            const sectionsWithTopics = await this.prismaService.$queryRaw<any>`
                SELECT 
                    s.id AS "sectionId",
                    s.name AS "sectionName",
                    s.type AS "sectionType",
                    s."partId" AS "sectionPartId",
                    COALESCE(us.percent, 0) AS "sectionPercent",
                    t.id AS "topicId",
                    t.name AS "topicName",
                    t."partId" AS "topicPartId",
                    t.frequency AS "topicFrequency",
                    COALESCE(ut.percent, 0) AS "topicPercent"
                FROM "Section" s
                LEFT JOIN "UserSection" us
                    ON us."sectionId" = s.id AND us."userId" = ${userId}
                LEFT JOIN "Topic" t
                    ON t."sectionId" = s.id
                LEFT JOIN "UserTopic" ut
                    ON ut."topicId" = t.id AND ut."userId" = ${userId}
                WHERE s."subjectId" = ${subjectId}
                ORDER BY s."partId" ASC, t."partId" ASC;
            `;

            const predictionSubtopics = await this.getPredictionSubtopics(
                userId, 
                subjectId, 
                detailLevel
            );

            const sectionMap = new Map<number, any>();
            let firstUncompletedTopic: { sectionId: number, topicId: number, sectionType: string } | null = null;
            let topicWithMinPercent: { sectionId: number, topicId: number, percent: number, sectionType: string } | null = null;

            for (const row of sectionsWithTopics) {
                let section = sectionMap.get(row.sectionId);
                if (!section) {
                    section = {
                        id: row.sectionId,
                        name: row.sectionName,
                        type: row.sectionType,
                        partId: row.sectionPartId,
                        percent: row.sectionPercent,
                        status: this.getStatus(row.sectionPercent, threshold),
                        topics: [],
                    };
                    sectionMap.set(row.sectionId, section);
                }

                if (row.topicId) {
                    const topicStatus = this.getStatus(row.topicPercent, threshold);
                    const isUncompleted = topicStatus !== 'completed';

                    if (firstUncompletedTopic === null && isUncompleted) {
                        firstUncompletedTopic = {
                            sectionId: row.sectionId,
                            topicId: row.topicId,
                            sectionType: row.sectionType
                        };
                    }

                    if (topicWithMinPercent === null || row.topicPercent < topicWithMinPercent.percent) {
                        topicWithMinPercent = {
                            sectionId: row.sectionId,
                            topicId: row.topicId,
                            percent: row.topicPercent,
                            sectionType: row.sectionType
                        };
                    }

                    const topic = {
                        id: row.topicId,
                        name: row.topicName,
                        partId: row.topicPartId,
                        percent: row.topicPercent,
                        status: this.getStatus(row.topicPercent, threshold),
                        repeat: false,
                        daysSinceLastTask: 0,
                        frequency: row.topicFrequency || 0,
                        subtopics: []
                    };
                    section.topics.push(topic);
                }
            }

            const enrichedSections = Array.from(sectionMap.values());
            const totalPercent = this.calculateTotalPercent(enrichedSections);
            
            const prediction = await this.calculatePrediction(
                threshold, 
                predictionSubtopics, 
                dailyStudyMinutes
            );

            let finalTopic = firstUncompletedTopic;
            if (finalTopic === null && topicWithMinPercent !== null)
                finalTopic = topicWithMinPercent;

            return {
                statusCode: 200,
                message: 'Działy zostały pomyślnie pobrane',
                sections: enrichedSections,
                total: totalPercent,
                prediction,
                subjectId,
                firstUncompletedTopic: finalTopic ? {
                    sectionId: finalTopic.sectionId,
                    topicId: finalTopic.topicId,
                    sectionType: finalTopic.sectionType
                } : null
            };
        } catch (error) {
            console.error(error);
            throw new InternalServerErrorException('Nie udało się pobrać działów');
        }
    }

    async findFirstUncompletedTopic(
        userId: number,
        subjectId: number
    ): Promise<{
        statusCode: number;
        message: string;
        topic: {
            sectionId: number;
            topicId: number;
            sectionType: string;
        } | null;
    }> {
        try {
            const firstResult = await this.prismaService.$queryRaw<Array<{
                sectionId: number;
                topicId: number;
                sectionType: string;
            }>>`
                WITH user_threshold AS (
                    SELECT COALESCE(us.threshold, 50) AS threshold_value
                    FROM "UserSubject" us
                    WHERE us."userId" = ${userId}
                    AND us."subjectId" = ${subjectId}
                    LIMIT 1
                )
                SELECT 
                    t."sectionId",
                    t.id AS "topicId",
                    s.type AS "sectionType"
                FROM "Topic" t
                INNER JOIN "Section" s ON s.id = t."sectionId"
                LEFT JOIN "UserTopic" ut 
                    ON ut."topicId" = t.id
                AND ut."userId" = ${userId}
                CROSS JOIN user_threshold uts
                WHERE s."subjectId" = ${subjectId}
                AND t."subjectId" = ${subjectId}
                AND COALESCE(ut.percent, 0) < uts.threshold_value
                ORDER BY
                    s."partId" ASC,
                    t."partId" ASC
                LIMIT 1;
            `;

            if (firstResult.length > 0) {
                return {
                    statusCode: 200,
                    message: 'Ostatni niezakończony temat pobrany',
                    topic: firstResult[0],
                };
            }

            const fallbackResult = await this.prismaService.$queryRaw<Array<{
                sectionId: number;
                topicId: number;
                sectionType: string;
            }>>`
                SELECT 
                    t."sectionId",
                    t.id AS "topicId",
                    s.type AS "sectionType"
                FROM "Topic" t
                INNER JOIN "Section" s ON s.id = t."sectionId"
                LEFT JOIN "UserTopic" ut 
                    ON ut."topicId" = t.id
                AND ut."userId" = ${userId}
                WHERE s."subjectId" = ${subjectId}
                AND t."subjectId" = ${subjectId}
                ORDER BY
                    COALESCE(ut.percent, 0) ASC,
                    s."partId" ASC,
                    t."partId" ASC
                LIMIT 1;
            `;

            if (fallbackResult.length > 0) {
                return {
                    statusCode: 200,
                    message:
                        'Wszystkie tematy ukończone — wybrano temat z najmniejszym postępem',
                    topic: fallbackResult[0],
                };
            }
            
            return {
                statusCode: 200,
                message: 'Brak tematów w przedmiocie',
                topic: null,
            };
        } catch (error) {
            throw new InternalServerErrorException(
                'Nie udało się znaleźć następnego tematu'
            );
        }
    }

    private async getPredictionSubtopics(
        userId: number, 
        subjectId: number, 
        detailLevel: string
    ): Promise<any[]> {
        const detailLevels = this.getDetailLevels(detailLevel);
        
        const detailLevelsSql = detailLevels.map(level => `'${level}'::"SubjectDetailLevel"`).join(', ');
        
        return await this.prismaService.$queryRaw<any>`
            SELECT 
                st.id,
                st.importance,
                st."detailLevel",
                COALESCE(ust.percent, 0) as percent
            FROM "Subtopic" st
            LEFT JOIN "UserSubtopic" ust ON ust."subtopicId" = st.id 
                AND ust."userId" = ${userId}
            WHERE st."subjectId" = ${subjectId}
                AND st."detailLevel" IN (${Prisma.raw(detailLevelsSql)})
            ORDER BY st.importance DESC;
        `;
    }

    private getDetailLevels(userDetailLevel: string): string[] {
        switch (userDetailLevel) {
            case 'MANDATORY': return ['MANDATORY'];
            case 'DESIRABLE': return ['MANDATORY', 'DESIRABLE'];
            case 'OPTIONAL': return ['MANDATORY', 'DESIRABLE', 'OPTIONAL'];
            default: return ['MANDATORY'];
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

            const subtopicsPromptOwn = Boolean(section.subtopicsPrompt && section.subtopicsPrompt.trim() !== "");
            const subtopicsStatusPromptOwn = Boolean(section.subtopicsStatusPrompt && section.subtopicsStatusPrompt.trim() !== "");
            const questionPromptOwn = Boolean(section.questionPrompt && section.questionPrompt.trim() !== "");
            const solutionPromptOwn = Boolean(section.solutionPrompt && section.solutionPrompt.trim() !== "");
            const answersPromptOwn = Boolean(section.answersPrompt && section.answersPrompt.trim() !== "");
            const closedSubtopicsPromptOwn = Boolean(section.closedSubtopicsPrompt && section.closedSubtopicsPrompt.trim() !== "");
            const vocabluaryPromptOwn = Boolean(section.vocabluaryPrompt && section.vocabluaryPrompt.trim() !== "");
            const wordsPromptOwn = Boolean(section.wordsPrompt && section.wordsPrompt.trim() !== "");
            const chatPromptOwn = Boolean(section.chatPrompt && section.chatPrompt.trim() !== "");
            const topicExpansionPromptOwn = Boolean(section.topicExpansionPrompt && section.topicExpansionPrompt.trim() !== "");
            const topicFrequencyPromptOwn = Boolean(section.topicFrequencyPrompt && section.topicFrequencyPrompt.trim() !== "");

            const prompts = {
                topicExpansionPrompt: topicExpansionPromptOwn ? section.topicExpansionPrompt.trim() : (subject.topicExpansionPrompt || ""),
                topicExpansionPromptOwn: topicExpansionPromptOwn,

                topicFrequencyPrompt: topicFrequencyPromptOwn ? section.topicFrequencyPrompt.trim() : (subject.topicFrequencyPrompt || ""),
                topicFrequencyPromptOwn: topicFrequencyPromptOwn,

                subtopicsPrompt: subtopicsPromptOwn ? section.subtopicsPrompt.trim() : (subject.subtopicsPrompt || ""),
                subtopicsPromptOwn: subtopicsPromptOwn,

                subtopicsStatusPrompt: subtopicsStatusPromptOwn ? section.subtopicsStatusPrompt.trim() : (subject.subtopicsStatusPrompt || ""),
                subtopicsStatusPromptOwn: subtopicsStatusPromptOwn,

                questionPrompt: questionPromptOwn ? section.questionPrompt.trim() : (subject.questionPrompt || ""),
                questionPromptOwn: questionPromptOwn,

                solutionPrompt: solutionPromptOwn ? section.solutionPrompt.trim() : (subject.solutionPrompt || ""),
                solutionPromptOwn: solutionPromptOwn,

                answersPrompt: answersPromptOwn ? section.answersPrompt.trim() : (subject.answersPrompt || ""),
                answersPromptOwn: answersPromptOwn,

                closedSubtopicsPrompt: closedSubtopicsPromptOwn ? section.closedSubtopicsPrompt.trim() : (subject.closedSubtopicsPrompt || ""),
                closedSubtopicsPromptOwn: closedSubtopicsPromptOwn,

                vocabluaryPrompt: vocabluaryPromptOwn ? section.vocabluaryPrompt.trim() : (subject.vocabluaryPrompt || ""),
                vocabluaryPromptOwn: vocabluaryPromptOwn,

                wordsPrompt: wordsPromptOwn ? section.wordsPrompt.trim() : (subject.wordsPrompt || ""),
                wordsPromptOwn: wordsPromptOwn,

                chatPrompt: chatPromptOwn ? section.chatPrompt.trim() : (subject.chatPrompt || ""),
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