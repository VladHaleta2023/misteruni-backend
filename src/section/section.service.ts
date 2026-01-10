import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DateUtils } from '../scripts/dateUtils';
import { SectionUpdateRequest } from '../section/dto/section-request.dto';
import { TimezoneService } from '../timezone/timezone.service';
import { SubjectDetailLevel, UserSubject } from '@prisma/client';

type Status = 'started' | 'progress' | 'completed';

@Injectable()
export class SectionService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly timezoneService: TimezoneService
    ) {}

    private calculateSectionsWithStatus(enrichedSections: any[], threshold: number) {
        return enrichedSections.map(section => {
            let status: Status = "started";
            if (section.percent == 0) status = "started";
            else if (section.percent >= threshold) status = "completed";
            else status = "progress";
            return { ...section, status };
        });
    }

    async calculateSubtopicsPercent(userId: number, subjectId: number, detailLevel: SubjectDetailLevel) {
        const endOfRangeUTC = this.timezoneService.localToUTC(new Date());

        const subtopics = await this.prismaService.subtopic.findMany({
            where: { subjectId, detailLevel },
            include: {
                progresses: {
                    where: { userId, updatedAt: { lte: endOfRangeUTC }, task: { finished: true, userId } },
                    include: { task: { select: { id: true } } },
                    orderBy: { updatedAt: 'asc' },
                },
            },
        });

        return subtopics.map(subtopic => {
            const progresses = subtopic.progresses ?? [];
            let percent = 0;
            const alpha = 0.7;
            
            if (progresses.length > 0) {
                const sortedProgresses = [...progresses].sort((a, b) => 
                    new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
                );
                
                let emaValue: number | null = null;
                for (const progress of sortedProgresses) {
                    const currentPercent = Math.min(100, progress.percent);
                    if (emaValue === null) emaValue = currentPercent;
                    else emaValue = (emaValue * (1 - alpha)) + (currentPercent * alpha);
                }
                percent = Math.min(100, Math.ceil(emaValue!));
            }
            
            return { ...subtopic, percent };
        });
    }

    async calculatePrediction(userId: number, now: Date, subjectId: number, threshold: number, subtopicsNow: any[], audioTopics: any[]) {
        try {
            const topics = await this.prismaService.topic.findMany({
                where: { subjectId },
                include: { subtopics: true, section: true, words: { where: { userId } } },
                orderBy: { partId: 'asc' }
            });

            if (!topics.length) return 'Infinity';

            const topicsForPrediction = topics.filter(t => t.section.type === 'Stories' || t.frequency >= 0);
            if (!topicsForPrediction.length) return 'Infinity';

            const subtopicIds = topicsForPrediction.flatMap(t => t.subtopics?.map(s => s.id) ?? []);
            const topicIds = topicsForPrediction.map(t => t.id);

            let totalWeight = 0;
            let currentWeight = 0;
            const globalCompression = 1.8;

            for (const topic of topicsForPrediction) {
                const thresholdNorm = Math.max(0.1, threshold / 100);
                const freqNorm = Math.min((topic.frequency / 100) * globalCompression, 1);

                if (topic.subtopics?.length) {
                    const importances = topic.subtopics.map(s => s.importance ?? 1);
                    const min = Math.min(...importances);
                    const max = Math.max(...importances);
                    const normalized = importances.map(v => max === min ? 1 : (v - min) / (max - min));
                    const difficulty = Math.min((normalized.reduce((a, b) => a + b, 0) / normalized.length) * globalCompression, 1);

                    const progress = topic.subtopics.reduce((sum, s, i) => {
                        const p = subtopicsNow.find(x => x.id === s.id)?.percent ?? 0;
                        return sum + (Math.min(100, p) / 100) * normalized[i];
                    }, 0) / topic.subtopics.length;

                    currentWeight += difficulty * Math.min(progress / thresholdNorm, 1) * freqNorm;
                    totalWeight += difficulty * freqNorm;
                } else {
                    const audio = audioTopics.find(a => a.id === topic.id);
                    const percent = Math.min(100, audio?.percent ?? 0) / 100;

                    const wordDifficulties = topic.words?.map(w => Math.max(1, 100 - (w.frequency ?? 50))) ?? [];
                    let difficulty = 0.6;
                    if (wordDifficulties.length) {
                        const min = Math.min(...wordDifficulties);
                        const max = Math.max(...wordDifficulties);
                        const normalized = wordDifficulties.map(v => max === min ? 1 : (v - min) / (max - min));
                        difficulty = Math.min((normalized.reduce((a, b) => a + b, 0) / normalized.length) * globalCompression, 1);
                    }

                    currentWeight += difficulty * Math.min(percent / thresholdNorm, 1) * freqNorm;
                    totalWeight += difficulty * freqNorm;
                }
            }

            if (totalWeight <= 0 || currentWeight <= 0) return 'Infinity';

            const [firstSub, firstTask] = await Promise.all([
                subtopicIds.length ? this.prismaService.subtopicProgress.findFirst({
                    where: { userId, subtopicId: { in: subtopicIds }, percent: { gt: 0 } },
                    orderBy: { updatedAt: 'asc' },
                    select: { updatedAt: true }
                }) : null,
                topicIds.length ? this.prismaService.task.findFirst({
                    where: { userId, topicId: { in: topicIds }, finished: true, percent: { gt: 0 } },
                    orderBy: { updatedAt: 'asc' },
                    select: { updatedAt: true }
                }) : null
            ]);

            const startDate = firstSub && firstTask 
                ? (firstSub.updatedAt < firstTask.updatedAt ? firstSub.updatedAt : firstTask.updatedAt)
                : firstSub?.updatedAt ?? firstTask?.updatedAt ?? now;

            const days = Math.max(1, Math.floor(
                (this.timezoneService.localToUTC(now).getTime() - this.timezoneService.localToUTC(startDate).getTime()) / 86400000
            ));

            const speed = currentWeight / days;
            const remaining = Math.max(0, totalWeight - currentWeight);
            const predictionDays = Math.max(1, remaining / Math.max(speed, 0.001));

            const result = new Date(now);
            result.setDate(result.getDate() + Math.ceil(predictionDays));
            const local = this.timezoneService.utcToLocal(result);
            return `${String(local.getDate()).padStart(2, '0')}.${String(local.getMonth() + 1).padStart(2, '0')}.${local.getFullYear()}`;
        } catch {
            return 'Infinity';
        }
    }

    private async batchCalculateTopicPercents(userId: number, topicIds: number[]) {
        if (topicIds.length === 0) return new Map();

        const endOfRangeUTC = this.timezoneService.localToUTC(new Date());
        const tasks = await this.prismaService.task.findMany({
            where: {
                userId,
                topicId: { in: topicIds },
                finished: true,
                parentTaskId: null,
                updatedAt: { lte: endOfRangeUTC },
            },
            select: { topicId: true, percent: true },
        });

        const tasksByTopicId: Record<number, any[]> = {};
        tasks.forEach(task => {
            if (!tasksByTopicId[task.topicId]) tasksByTopicId[task.topicId] = [];
            tasksByTopicId[task.topicId].push(task);
        });

        const result = new Map();
        topicIds.forEach(topicId => {
            const tasks = tasksByTopicId[topicId] || [];
            const percent = tasks.length > 0
                ? Math.min(100, tasks.reduce((acc, t) => acc + t.percent, 0) / tasks.length)
                : 0;
            result.set(topicId, { id: topicId, percent });
        });

        return result;
    }

    private calculateTopicStatus(percent: number, threshold: number): Status {
        if (percent === 0) return 'started';
        else if (percent >= threshold) return 'completed';
        else return 'progress';
    }

    private async processSectionsWithTopics(userId: number, sections: any[], subjectId: number, updatedSubtopics: any[], threshold: number) {
        const updatedSubtopicsWithPercent = updatedSubtopics.map(sub => ({
            ...sub,
            percent: Math.min(100, sub.percent)
        }));

        const subtopicsGrouped: Record<number, any[]> = {};
        updatedSubtopicsWithPercent.forEach(sub => {
            if (!subtopicsGrouped[sub.topicId]) subtopicsGrouped[sub.topicId] = [];
            subtopicsGrouped[sub.topicId].push(sub);
        });

        const topicsFromDB = await this.prismaService.topic.findMany({
            where: { subjectId },
            orderBy: { partId: 'asc' },
        });

        const topicIdsWithoutSubtopics = topicsFromDB
            .filter(topic => !subtopicsGrouped[topic.id]?.length)
            .map(t => t.id);

        const topicPercentMap = await this.batchCalculateTopicPercents(userId, topicIdsWithoutSubtopics);

        const allTopics = topicsFromDB.map(topic => {
            const subtopics = subtopicsGrouped[topic.id] || [];
            let percent = 0;

            if (subtopics.length > 0) {
                const totalPercent = subtopics.reduce((acc, s) => acc + Math.min(100, s.percent), 0);
                percent = totalPercent / subtopics.length;
            } else {
                const calculated = topicPercentMap.get(topic.id);
                if (calculated) percent = Math.min(100, calculated.percent);
            }

            percent = Math.min(100, Math.ceil(percent));
            return { 
                ...topic, 
                subtopics, 
                percent,
                status: this.calculateTopicStatus(percent, threshold)
            };
        });

        const topicsBySection: Record<number, any[]> = {};
        allTopics.forEach(topic => {
            if (!topicsBySection[topic.sectionId]) topicsBySection[topic.sectionId] = [];
            topicsBySection[topic.sectionId].push(topic);
        });

        return sections
            .map(section => {
                const topics = topicsBySection[section.id] || [];
                if (!topics.length) return null;

                const totalPercent = topics.reduce((acc, t) => acc + Math.min(100, t.percent), 0);
                const percent = Math.min(100, Math.ceil(totalPercent / topics.length));

                return { ...section, topics, percent };
            })
            .filter(Boolean) as any[];
    }

    private calculateTotalPercent(sectionsWithStatus: any[]) {
        const totalSections = sectionsWithStatus.length || 1;
        let sumPercentCompleted = 0;
        let sumPercentProgress = 0;

        sectionsWithStatus.forEach(section => {
            const p = Math.min(100, section.percent ?? 0);
            if (section.status === "completed") sumPercentCompleted += p;
            else if (section.status === "progress") sumPercentProgress += p;
        });

        const maxPercent = totalSections * 100;
        const percentCompleted = Math.ceil((sumPercentCompleted / maxPercent) * 100);
        const percentProgress = Math.ceil((sumPercentProgress / maxPercent) * 100);
        const percentStarted = 100 - percentCompleted - percentProgress;

        const totalPercent: Record<Status, number> = {
            started: percentStarted ?? 0,
            progress: percentProgress ?? 0,
            completed: percentCompleted ?? 0,
        };

        if (Object.values(totalPercent).every(val => val === 0)) {
            totalPercent.started = 100;
        }

        return totalPercent;
    }

    private extractStoriesTopicsWithPercents(enrichedSections: any[]): any[] {
        const storiesTopics: any[] = [];
        
        enrichedSections.forEach(section => {
            if (!section?.topics) return;
            
            section.topics.forEach(topic => {
                const sectionType = topic.section?.type || section.type || section.section?.type;
                if (sectionType === "Stories") {
                    storiesTopics.push({
                        id: topic.id,
                        percent: topic.percent || 0,
                        sectionId: topic.sectionId || section.id,
                        sectionType: "Stories",
                        topicName: topic.name || "",
                        subtopicsCount: topic.subtopics?.length || 0
                    });
                }
            });
        });
        
        return storiesTopics;
    }

    async findSections(userId: number, subjectId: number) {
        try {
            const [subject, sections] = await Promise.all([
                this.prismaService.subject.findUnique({ where: { id: subjectId } }),
                this.prismaService.section.findMany({ where: { subjectId }, orderBy: { partId: 'asc' } })
            ]);

            if (!subject) throw new BadRequestException('Przedmiot nie został znaleziony');

            const userSubject = await this.prismaService.userSubject.findUnique({
                where: { userId_subjectId: { subjectId, userId } },
                select: { threshold: true, detailLevel: true }
            });

            const detailLevel = userSubject?.detailLevel ?? SubjectDetailLevel.MANDATORY;
            const threshold = userSubject?.threshold ?? 50;
            const updatedSubtopics = await this.calculateSubtopicsPercent(userId, subjectId, detailLevel);

            const startOfTodayUTC = this.timezoneService.getStartOfTodayUTC();
            const lastTasks = await this.prismaService.task.findMany({
                where: { userId, topic: { subjectId }, finished: true, updatedAt: { lt: startOfTodayUTC } },
                select: { topicId: true, updatedAt: true },
                orderBy: { updatedAt: 'desc' },
            });

            const lastTaskDates = new Map<number, Date>();
            lastTasks.forEach(task => {
                if (!lastTaskDates.has(task.topicId) || task.updatedAt > lastTaskDates.get(task.topicId)!) {
                    lastTaskDates.set(task.topicId, task.updatedAt);
                }
            });

            const enrichedSections = await this.processSectionsWithTopics(
                userId, sections, subjectId, updatedSubtopics, threshold
            );

            const REPEAT_DAYS = 30;
            const enrichedSectionsWithTopics = enrichedSections.map(section => ({
                ...section,
                topics: section.topics.map(topic => {
                    const lastTaskDate = lastTaskDates.get(topic.id);
                    let repeat = false;
                    let daysDiff = 0;

                    if (lastTaskDate) {
                        daysDiff = this.timezoneService.getDaysDifference(lastTaskDate);
                        if (topic.percent >= threshold) repeat = daysDiff >= REPEAT_DAYS;
                    }

                    return {
                        ...topic,
                        frequency: Math.ceil(topic.frequency - (topic.percent * topic.frequency / 100)),
                        baseFrequency: topic.frequency,
                        repeat,
                        daysSinceLastTask: daysDiff,
                    };
                })
            }));

            const sectionsWithStatus = this.calculateSectionsWithStatus(enrichedSectionsWithTopics, threshold);

            const sectionsWithRepeat = sectionsWithStatus.map(section => ({
                ...section,
                repeat: section.topics?.some(topic => topic.repeat) || false,
            }));

            const now = new Date();
            const startOfRange = DateUtils.getMonday(now, 0);
            let endOfRange = new Date();
            if (now.getDay() === 0) {
                endOfRange = DateUtils.getSunday(now, 0);
                endOfRange.setHours(23, 59, 59, 999);
            }

            const startOfRangeUTC = this.timezoneService.localToUTC(startOfRange);
            const endOfRangeUTC = this.timezoneService.localToUTC(endOfRange);

            const subtopicsByTopic: Record<number, any[]> = {};
            updatedSubtopics.forEach(sub => {
                if (!subtopicsByTopic[sub.topicId]) subtopicsByTopic[sub.topicId] = [];
                subtopicsByTopic[sub.topicId].push(sub);
            });

            let closedSubtopics = 0;
            let closedTopics = 0;
            const topics = await this.prismaService.topic.findMany({ where: { subjectId } });
            topics.forEach(topic => {
                const subtopics = subtopicsByTopic[topic.id] || [];
                const completed = subtopics.filter(s => Math.min(100, s.percent) >= threshold).length;
                closedSubtopics += completed;
                if (subtopics.length > 0 && completed === subtopics.length) closedTopics++;
            });

            const [solvedTasks, solvedTasksCompleted, prediction, totalPercent] = await Promise.all([
                this.prismaService.task.count({
                    where: { userId, finished: true, parentTaskId: null, updatedAt: { gte: startOfRangeUTC, lte: endOfRangeUTC }, topic: { subjectId } },
                }),
                this.prismaService.task.count({
                    where: { userId, finished: true, parentTaskId: null, updatedAt: { gte: startOfRangeUTC, lte: endOfRangeUTC }, percent: { gte: threshold }, topic: { subjectId } },
                }),
                this.calculatePrediction(userId, now, subjectId, threshold, updatedSubtopics, this.extractStoriesTopicsWithPercents(enrichedSections)),
                Promise.resolve(this.calculateTotalPercent(sectionsWithStatus))
            ]);

            return {
                statusCode: 200,
                message: 'Działy zostały pomyślnie pobrane',
                sections: sectionsWithRepeat,
                total: totalPercent,
                statistics: {
                    solvedTasksCount: solvedTasks,
                    solvedTasksCountCompleted: solvedTasksCompleted,
                    closedSubtopicsCount: closedSubtopics,
                    closedTopicsCount: closedTopics,
                    prediction
                },
                subject
            };
        } catch (error) {
            throw new InternalServerErrorException('Nie udało się pobrać działów');
        }
    }

    async findSectionById(
        userId: number,
        subjectId: number,
        id: number,
        withSubject = true,
        withTopics = false,
        withSubtopics = false,
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
            const subQuestionsPromptOwn = Boolean(section.subQuestionsPrompt && section.subQuestionsPrompt.trim() !== "");
            const vocabluaryPromptOwn = Boolean(section.vocabluaryPrompt && section.vocabluaryPrompt.trim() !== "");
            const wordsPromptOwn = Boolean(section.wordsPrompt && section.wordsPrompt.trim() !== "");
            const topicExpansionPromptOwn = Boolean(section.topicExpansionPrompt && section.topicExpansionPrompt.trim() !== "");

            const prompts = {
                topicExpansionPrompt: topicExpansionPromptOwn ? section.topicExpansionPrompt.trim() : (subject.topicExpansionPrompt || ""),
                topicExpansionPromptOwn: topicExpansionPromptOwn,

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

                subQuestionsPrompt: subQuestionsPromptOwn ? section.subQuestionsPrompt.trim() : (subject.subQuestionsPrompt || ""),
                subQuestionsPromptOwn: subQuestionsPromptOwn,

                vocabluaryPrompt: vocabluaryPromptOwn ? section.vocabluaryPrompt.trim() : (subject.vocabluaryPrompt || ""),
                vocabluaryPromptOwn: vocabluaryPromptOwn,

                wordsPrompt: wordsPromptOwn ? section.wordsPrompt.trim() : (subject.wordsPrompt || ""),
                wordsPromptOwn: wordsPromptOwn,
            };

            let enrichedSection: any = {
                ...section,
                ...prompts,
                percent: 0,
                topics: [],
            };

            if (withTopics) {
                const topics = await this.prismaService.topic.findMany({
                    where: { subjectId, sectionId: section.id },
                    orderBy: { partId: 'asc' },
                    include: {
                        tasks: {
                            where: {
                                userId,
                                finished: true,
                                parentTaskId: null,
                            },
                            select: {
                                percent: true,
                            },
                        },
                        words: {
                            where: { userId },
                            select: {
                                frequency: true,
                            },
                        },
                    },
                });

                let subtopicsGrouped: Record<number, any[]> = {};

                if (withSubtopics) {
                    const topicIds = topics.map(t => t.id);
                    const subtopics = await this.prismaService.subtopic.findMany({
                        where: { topicId: { in: topicIds } },
                        orderBy: { name: 'asc' },
                        include: {
                            progresses: {
                                where: { userId },
                                select: {
                                    percent: true,
                                },
                            },
                        },
                    });

                    const subtopicsWithProgress = subtopics.map(subtopic => {
                        const userProgress = subtopic.progresses[0];
                        const percent = userProgress ? Math.min(100, userProgress.percent) : 0;

                        return {
                            id: subtopic.id,
                            topicId: subtopic.topicId,
                            name: subtopic.name,
                            percent: percent,
                        };
                    });

                    subtopicsGrouped = subtopicsWithProgress.reduce((acc, sub) => {
                        if (!acc[sub.topicId]) acc[sub.topicId] = [];
                        acc[sub.topicId].push(sub);
                        return acc;
                    }, {} as Record<number, any[]>);
                }

                const topicsWithPercent = topics.map(topic => {
                    const subtopics = withSubtopics ? subtopicsGrouped[topic.id] || [] : [];
                    
                    let percent = 0;

                    if (subtopics.length > 0) {
                        if (subtopics.length > 0) {
                            percent = subtopics.reduce((acc, s) => acc + (s.percent ?? 0), 0) / subtopics.length;
                        }
                    } else if (topic.tasks && topic.tasks.length > 0) {
                        const taskPercents = topic.tasks.map(t => Math.min(100, t.percent));
                        percent = taskPercents.reduce((acc, p) => acc + p, 0) / taskPercents.length;
                    }

                    return {
                        ...topic,
                        percent: Math.min(100, Math.ceil(percent)),
                        subtopics,
                        frequency: topic.words && topic.words.length > 0
                            ? Math.ceil(topic.frequency - (percent * topic.frequency / 100))
                            : topic.frequency,
                        baseFrequency: topic.frequency,
                    };
                });

                const validTopics = topicsWithPercent.filter(t => 
                    withSubtopics 
                        ? t.subtopics.length > 0
                        : true
                );
                
                const percent = validTopics.length > 0
                    ? validTopics.reduce((acc, t) => acc + t.percent, 0) / validTopics.length
                    : 0;

                enrichedSection = {
                    ...enrichedSection,
                    percent: Math.min(100, Math.ceil(percent)),
                    topics: topicsWithPercent,
                };
            }

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