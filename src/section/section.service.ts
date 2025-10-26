import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DateUtils } from '../scripts/dateUtils';
import { SectionUpdateRequest } from '../section/dto/section-request.dto';

type Status = 'blocked' | 'started' | 'progress' | 'completed';
type DeltaStatus = 'completed' | 'error' | 'completed error';

interface Subtopic extends Record<string, any> {
    blocked: boolean;
    percent: number;
    status?: Status;
}

interface Topic extends Record<string, any> {
    blocked: boolean;
    subtopics: Subtopic[];
    status?: Status;
}

interface Section extends Record<string, any> {
    blocked: boolean;
    topics: Topic[];
    status?: Status;
}

@Injectable()
export class SectionService {
    constructor(private readonly prismaService: PrismaService) {}

    private getStatus(percent: number, blocked: boolean, threshold: number): Status {
        if (blocked) return 'blocked';
        if (percent === 0) return 'started';
        if (percent < threshold) return 'progress';
        return 'completed';
    }

    private calculateSectionsWithStatus(enrichedSections: any[], threshold: number) {
        return enrichedSections.map(section => {
            const topics = section.topics || [];

            const allCompleted = topics.length > 0 && topics.every(t => t.status === 'completed');
            const allInProgress = topics.length > 0 && topics.every(t => t.status === 'progress');
            const allStarted = topics.length > 0 && topics.every(t => t.status === 'started');
            const allBlocked = topics.length > 0 && topics.every(t => t.status === 'blocked');
            const anyCompleted = topics.some(t => t.status === 'completed');
            const anyInProgress = topics.some(t => t.status === 'progress');
            const anyStarted = topics.some(t => t.status === 'started');

            let status: Status = "started";
            let process: Status = "started";

            if (allBlocked) {
                status = "blocked";
                process = "blocked";
            }
            else if (allCompleted) {
                status = "completed";
                process = "completed";
            }
            else if (allInProgress) {
                status = "progress";
                process = "progress";
            }
            else if (allStarted) {
                status = "started";
                process = "started";
            }
            else if (anyCompleted && anyInProgress) {
                status = "completed";
                process = "progress"
            }
            else if (anyCompleted && anyStarted) {
                status = "completed";
                process = "started"
            }
            else if (anyInProgress && anyStarted) {
                status = "progress";
                process = "started"
            }

            return { ...section, topics, status, process };
        });
    }

    addStatusToSections(sections: Section[], threshold: number): Section[] {
        return sections.map(section => {
            const updatedTopics = section.topics.map(topic => {
                if (topic.subtopics && topic.subtopics.length > 0) {
                    const updatedSubtopics = topic.subtopics.map(subtopic => ({
                        ...subtopic,
                        status: this.getStatus(subtopic.percent ?? 0, !!subtopic.blocked, threshold),
                    }));

                    const activeSubs = updatedSubtopics.filter(st => st.status !== 'blocked');
                    const allCompleted = activeSubs.every(st => st.status === 'completed');
                    const anyProgress = activeSubs.some(st => st.status === 'progress');
                    const anyStarted = activeSubs.some(st => st.status === 'started');
                    const anyCompleted = activeSubs.some(st => st.status === 'completed');

                    let topicStatus: Status;
                    if (topic.blocked || activeSubs.length === 0) topicStatus = 'blocked';
                    else if (allCompleted) topicStatus = 'completed';
                    else if (anyProgress || (anyStarted && anyCompleted)) topicStatus = 'progress';
                    else topicStatus = 'started';

                    return { ...topic, subtopics: updatedSubtopics, status: topicStatus };
                }

                return {
                    ...topic,
                    status: this.getStatus(topic.percent ?? 0, !!topic.blocked, threshold),
                };
            });

            const activeTopics = updatedTopics.filter(t => t.status !== 'blocked');
            const allStarted = activeTopics.every(t => t.status === 'started');
            const allCompleted = activeTopics.every(t => t.status === 'completed');
            const anyProgress = activeTopics.some(t => t.status === 'progress');
            const anyStarted = activeTopics.some(t => t.status === 'started');
            const anyCompleted = activeTopics.some(t => t.status === 'completed');

            let sectionStatus: Status;
            if (section.blocked || activeTopics.length === 0) sectionStatus = 'blocked';
            else if (allCompleted) sectionStatus = 'completed';
            else if (anyProgress || (anyStarted && anyCompleted)) sectionStatus = 'progress';
            else sectionStatus = 'started';

            return { ...section, topics: updatedTopics, status: sectionStatus };
        });
    }

    async calculateSubtopicsPercent(subjectId: number, weekOffset = 0) {
        const now = new Date();
        const startOfRange = DateUtils.getMonday(now, weekOffset);
        const endOfRange = DateUtils.getSunday(now, weekOffset);

        const subtopics = await this.prismaService.subtopic.findMany({
            where: { subjectId },
            include: {
                progresses: {
                where: {
                    updatedAt: { gte: startOfRange, lte: endOfRange },
                    task: { finished: true },
                },
                include: { task: { select: { id: true } } },
                },
            },
        });

        const updatedSubtopics = subtopics.map(subtopic => {
            const progresses = subtopic.progresses ?? [];
            const percent =
                progresses.length > 0
                ? Math.round(progresses.reduce((acc, p) => acc + p.percent, 0) / progresses.length)
                : 0;
            return { ...subtopic, percent };
        });

        return updatedSubtopics;
    }

    async calculatePrediction(
        now: Date,
        currentMonday: Date,
        endOfWeek: Date,
        subjectId: number,
        subject: any,
        subtopicsNow: any[],
        subtopicsThen: any[]
    ) {
        const endOfWeekFullTime = new Date(now);
        const endOfWeekCopy = new Date(endOfWeek);
        endOfWeekCopy.setHours(23, 59, 59, 999);

        const startOfWeekThenPrediction = new Date(currentMonday);
        startOfWeekThenPrediction.setDate(currentMonday.getDate() - 14);

        const endOfWeekThenPrediction = new Date(startOfWeekThenPrediction);
        endOfWeekThenPrediction.setDate(startOfWeekThenPrediction.getDate() + 6);

        const daysPrediction = Math.floor(
            (endOfWeekFullTime.getTime() - endOfWeekThenPrediction.getTime()) / (1000 * 60 * 60 * 24)
        );

        const importanceSum = await this.prismaService.subtopic.aggregate({
            where: { subjectId },
            _sum: { importance: true },
        });

        const totalImportance =
        (importanceSum._sum.importance ?? 0) * (subject.threshold / 100);

        let thenImportance = 0;
        for (const sub of subtopicsThen) {
            thenImportance += sub.importance * Math.min(sub.percent ?? 0, 100) / 100;
        }

        const leftImportance = totalImportance - thenImportance;

        let deltaImportance = 0;
        for (let i = 0; i < subtopicsNow.length; i++) {
            const prev = Math.min(subtopicsThen[i]?.percent ?? 0, 100);
            const curr = Math.min(subtopicsNow[i]?.percent ?? 0, 100);
            deltaImportance += subtopicsNow[i].importance * Math.max(0, curr - prev) / 100;
        }

        let prediction: number | undefined;
        if (deltaImportance > 0) {
            prediction = (leftImportance / deltaImportance) * daysPrediction;
        }

        const resultDate = new Date(endOfWeekFullTime);
        if (prediction) {
            resultDate.setDate(resultDate.getDate() + Math.ceil(prediction));
            const dd = String(resultDate.getDate()).padStart(2, '0');
            const mm = String(resultDate.getMonth() + 1).padStart(2, '0');
            const yyyy = resultDate.getFullYear();
            return `${dd}.${mm}.${yyyy}`;
        }
        return 'Infinity';
    }

    private async batchCalculateTopicPercents(topics: any[], weekOffset: number) {
        if (topics.length === 0) return [];

        const topicIds = topics.map(t => t.id);
        const now = new Date();
        const endOfRange = DateUtils.getSunday(now, weekOffset);
        const startOfRangePrevious = DateUtils.getMonday(now, weekOffset - 1);
        const endOfRangePrevious = DateUtils.getSunday(now, weekOffset - 1);

        const [currentTasks, previousTasks] = await Promise.all([
            this.prismaService.task.findMany({
                where: {
                    topicId: { in: topicIds },
                    finished: true,
                    parentTaskId: null,
                    updatedAt: { lte: endOfRange },
                },
                select: { topicId: true, percent: true },
            }),
            this.prismaService.task.findMany({
                where: {
                    topicId: { in: topicIds },
                    finished: true,
                    parentTaskId: null,
                    updatedAt: { gte: startOfRangePrevious, lte: endOfRangePrevious },
                },
                select: { topicId: true, percent: true },
            })
        ]);

        const tasksByTopicId = currentTasks.reduce((acc, task) => {
            if (!acc[task.topicId]) acc[task.topicId] = [];
            acc[task.topicId].push(task);
            return acc;
        }, {} as Record<number, any[]>);

        const previousTasksByTopicId = previousTasks.reduce((acc, task) => {
            if (!acc[task.topicId]) acc[task.topicId] = [];
            acc[task.topicId].push(task);
            return acc;
        }, {} as Record<number, any[]>);

        return topics.map(topic => {
            const tasks = tasksByTopicId[topic.id] || [];
            const prevTasks = previousTasksByTopicId[topic.id] || [];

            const percent = tasks.length > 0
                ? tasks.reduce((acc, t) => acc + t.percent, 0) / tasks.length
                : 0;

            const previousPercent = prevTasks.length > 0
                ? prevTasks.reduce((acc, t) => acc + t.percent, 0) / prevTasks.length
                : 0;

            const delta = percent - previousPercent;

            return { id: topic.id, percent, delta };
        });
    }

    private calculateTopicStatus(subtopics: any[], percent: number, threshold: number): Status {
        if (subtopics.length > 0 && subtopics.every(s => s.blocked)) {
            return 'blocked';
        } else if (percent === 0) {
            return 'started';
        } else {
            const elements = subtopics.length > 0 ? subtopics : [{ percent }];
            const allCompleted = elements.every(el => (el.percent ?? 0) >= threshold);
            return allCompleted ? 'completed' : 'progress';
        }
    }

    private async processSectionsWithTopics(
        sections: any[],
        subjectId: number,
        updatedSubtopics: any[],
        previousSubtopics: any[],
        withSubtopics: boolean,
        weekOffset: number,
        threshold: number
    ) {
        const previousMap = new Map(previousSubtopics.map(sub => [sub.id, sub]));
        const updatedSubtopicsWithDelta = updatedSubtopics.map(sub => ({
            ...sub,
            delta: weekOffset !== 0 ? (sub.percent - (previousMap.get(sub.id)?.percent || 0)) : 0
        }));

        const subtopicsGrouped = withSubtopics 
            ? updatedSubtopicsWithDelta.reduce((acc, sub) => {
                if (!acc[sub.topicId]) acc[sub.topicId] = [];
                acc[sub.topicId].push(sub);
                return acc;
            }, {} as Record<number, any[]>)
            : {};

        const topicsFromDB = await this.prismaService.topic.findMany({
            where: { subjectId },
            orderBy: { partId: 'asc' },
        });

        const topicsWithoutSubtopics = topicsFromDB.filter(topic => 
            !withSubtopics || !subtopicsGrouped[topic.id]?.length
        );
        
        const topicsWithCalculatedPercents = await this.batchCalculateTopicPercents(
            topicsWithoutSubtopics, 
            weekOffset
        );

        const topicPercentMap = new Map(
            topicsWithCalculatedPercents.map(t => [t.id, t])
        );

        const allTopics = topicsFromDB.map(topic => {
            const subtopics = withSubtopics ? (subtopicsGrouped[topic.id] || []) : [];
            
            let percent = 0;
            let delta = 0;

            if (subtopics.length > 0) {
                percent = subtopics.reduce((acc, s) => acc + s.percent, 0) / subtopics.length;
                const nonZeroDeltas = subtopics.filter(s => s.delta !== 0);
                delta = nonZeroDeltas.length
                    ? nonZeroDeltas.reduce((acc, s) => acc + s.delta!, 0) / nonZeroDeltas.length
                    : 0;
            } else {
                const calculated = topicPercentMap.get(topic.id);
                if (calculated) {
                    percent = calculated.percent;
                    delta = calculated.delta;
                }
            }

            percent = Math.round(percent);
            const deltaStatus: DeltaStatus = delta >= 0 ? 'completed' : 'error';

            return { 
                ...topic, 
                subtopics, 
                percent, 
                delta, 
                deltaStatus,
                status: this.calculateTopicStatus(subtopics, percent, threshold)
            };
        });

        const topicsBySection = allTopics.reduce((acc, topic) => {
            if (!acc[topic.sectionId]) acc[topic.sectionId] = [];
            acc[topic.sectionId].push(topic);
            return acc;
        }, {} as Record<number, any[]>);

        const enrichedSections = sections
            .map(section => {
                const topics = topicsBySection[section.id] || [];
                if (!topics.length) return null;

                const percent = Math.round(topics.reduce((acc, t) => acc + t.percent, 0) / topics.length);
                const nonZeroDeltas = topics.filter(t => t.delta !== 0);
                const delta = nonZeroDeltas.length
                    ? nonZeroDeltas.reduce((acc, t) => acc + t.delta!, 0) / nonZeroDeltas.length
                    : 0;

                const allCompleted = topics.every(t => t.deltaStatus === 'completed');
                const allError = topics.every(t => t.deltaStatus === 'error');
                const deltaStatus: DeltaStatus = allCompleted
                    ? 'completed'
                    : allError
                    ? 'error'
                    : 'completed error';

                return { ...section, topics, percent, delta, deltaStatus };
            })
            .filter(Boolean) as any[];
        return enrichedSections;
    }

    private calculateTotalPercent(sectionsWithStatus: any[]) {
        const totalSections = sectionsWithStatus.length || 1;
        let sumPercentCompleted = 0;
        let sumPercentBlocked = 0;
        let sumPercentProgress = 0;

        sectionsWithStatus.forEach(section => {
            const p = section.percent ?? 0;

            if (section.blocked) {
                sumPercentBlocked += p;
            } else if (section.status === "completed" && section.process === "completed") {
                sumPercentCompleted += p;
            } else if (section.status !== "started" || section.process !== "started") {
                sumPercentProgress += p;
            }
        });

        const maxPercent = totalSections * 100;
        const percentBlocked = Math.round((sumPercentBlocked / maxPercent) * 100);
        const percentCompleted = Math.round((sumPercentCompleted / maxPercent) * 100);
        const percentProgress = Math.round((sumPercentProgress / maxPercent) * 100);
        const percentStarted = 100 - percentBlocked - percentCompleted - percentProgress;

        const totalPercent: Record<Status, number> = {
            blocked: percentBlocked ?? 0,
            started: percentStarted ?? 0,
            progress: percentProgress ?? 0,
            completed: percentCompleted ?? 0,
        };

        if (Object.values(totalPercent).every(val => val === 0)) {
            totalPercent.started = 100;
        }

        return totalPercent;
    }

    async findSections(
        subjectId: number,
        withSubject = false,
        withTopics = false,
        withSubtopics = false,
        weekOffset: number = 0
    ) {
        try {
            const [subject, sections] = await Promise.all([
                this.prismaService.subject.findUnique({
                    where: { id: subjectId },
                }),
                this.prismaService.section.findMany({
                    where: { subjectId },
                    orderBy: { partId: 'asc' },
                })
            ]);

            if (!subject) {
                throw new BadRequestException('Przedmiot nie został znaleziony');
            }

            const calculateCurrent = this.calculateSubtopicsPercent(subjectId, weekOffset);
            const calculatePrevious = weekOffset !== 0 
                ? this.calculateSubtopicsPercent(subjectId, weekOffset - 1)
                : Promise.resolve([]);

            const [updatedSubtopics, previousSubtopics] = await Promise.all([
                calculateCurrent,
                calculatePrevious
            ]);

            let enrichedSections: any[] = [];
            const threshold = Number(subject.threshold) || 0;

            if (withTopics) {
                enrichedSections = await this.processSectionsWithTopics(
                    sections,
                    subjectId,
                    updatedSubtopics,
                    previousSubtopics,
                    withSubtopics,
                    weekOffset,
                    threshold
                );
            } else {
                enrichedSections = sections.map(section => ({
                    ...section,
                    topics: [],
                    percent: 0,
                    delta: 0,
                    deltaStatus: 'completed',
                }));
            }

            const sectionsWithStatus = this.calculateSectionsWithStatus(enrichedSections, threshold);
            
            const [statistics, totalPercent] = await Promise.all([
                this.calculateStatSections(subjectId, weekOffset, updatedSubtopics, previousSubtopics),
                Promise.resolve(this.calculateTotalPercent(sectionsWithStatus))
            ]);

            const response: any = {
                statusCode: 200,
                message: 'Działy zostały pomyślnie pobrane',
                sections: sectionsWithStatus,
                total: totalPercent,
                statistics,
            };

            if (withSubject) {
                response.subject = subject;
            }

            return response;
        } catch (error) {
            throw new InternalServerErrorException('Nie udało się pobrać działów');
        }
    }

    async calculateStatSections(
        subjectId: number,
        weekOffset = 0,
        subtopicsNow: any[],
        subtopicsThen: any[]
    ) {
        try {
            const subject = await this.prismaService.subject.findUnique({ where: { id: subjectId } });
            if (!subject) throw new BadRequestException('Przedmiot nie został znaleziony');

            if (weekOffset > 0) weekOffset = 0;

            const topics = await this.prismaService.topic.findMany({
                where: { subjectId },
                orderBy: { partId: 'asc' },
            });

            const now = new Date();
            const startOfWeek = DateUtils.getMonday(now, weekOffset);
            const endOfWeek = DateUtils.getSunday(now, weekOffset);

            const groupByTopic = (subs: any[]) =>
                subs.reduce<Record<number, any[]>>((acc, sub) => {
                if (!acc[sub.topicId]) acc[sub.topicId] = [];
                acc[sub.topicId].push(sub);
                return acc;
                }, {});

            const subsNowByTopic = groupByTopic(subtopicsNow);
            const subsThenByTopic = groupByTopic(subtopicsThen);

            let totalSubsNow = 0;
            let totalSubsThen = 0;
            let totalTopicsNow = 0;
            let totalTopicsThen = 0;

            for (const topic of topics) {
                const nowSubs = subsNowByTopic[topic.id] || [];
                const thenSubs = subsThenByTopic[topic.id] || [];
                const closedNow = nowSubs.filter(sub => sub.percent >= subject.threshold);
                const closedThen = thenSubs.filter(sub => sub.percent >= subject.threshold);

                totalSubsNow += closedNow.length;
                totalSubsThen += closedThen.length;
                if (nowSubs.length && closedNow.length === nowSubs.length) totalTopicsNow++;
                if (thenSubs.length && closedThen.length === thenSubs.length) totalTopicsThen++;
            }

            const formatDate = (d: Date) =>
                `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;

            let predictionResult: string | null = null;
            if (weekOffset === 0) {
                predictionResult = await this.calculatePrediction(
                    now,
                    startOfWeek,
                    endOfWeek,
                    subjectId,
                    subject,
                    subtopicsNow,
                    subtopicsThen
                );
            }

            const solvedTasksCount = await this.prismaService.task.count({
                where: {
                finished: true,
                parentTaskId: null,
                updatedAt: { gte: startOfWeek, lte: endOfWeek },
                topic: { subjectId },
                },
            });

            const solvedTasksCountCompleted = await this.prismaService.task.count({
                where: {
                finished: true,
                parentTaskId: null,
                updatedAt: { gte: startOfWeek, lte: endOfWeek },
                percent: { gte: subject.threshold },
                topic: { subjectId },
                },
            });

            const weekLabel = weekOffset < 0 ? `${weekOffset} tydz.` : 'bieżący';

            return {
                solvedTasksCount,
                solvedTasksCountCompleted,
                closedSubtopicsCount: totalSubsNow - totalSubsThen,
                closedTopicsCount: totalTopicsNow - totalTopicsThen,
                startDateStr: formatDate(startOfWeek),
                endDateStr: formatDate(endOfWeek),
                weekLabel,
                prediction: predictionResult,
            };
        } catch {
            return {
                solvedTasksCountCompleted: 0,
                solvedTasksCount: 0,
                closedSubtopicsCount: 0,
                closedTopicsCount: 0,
                startDateStr: '',
                endDateStr: '',
                weekLabel: '',
                prediction: null,
            };
        }
    }

    async findSectionById(
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
            const questionPromptOwn = Boolean(section.questionPrompt && section.questionPrompt.trim() !== "");
            const solutionPromptOwn = Boolean(section.solutionPrompt && section.solutionPrompt.trim() !== "");
            const answersPromptOwn = Boolean(section.answersPrompt && section.answersPrompt.trim() !== "");
            const closedSubtopicsPromptOwn = Boolean(section.closedSubtopicsPrompt && section.closedSubtopicsPrompt.trim() !== "");
            const subQuestionsPromptOwn = Boolean(section.subQuestionsPrompt && section.subQuestionsPrompt.trim() !== "");
            const vocabluaryPromptOwn = Boolean(section.vocabluaryPrompt && section.vocabluaryPrompt.trim() !== "");

            const prompts = {
                subtopicsPrompt: subtopicsPromptOwn ? section.subtopicsPrompt.trim() : (subject.subtopicsPrompt || ""),
                subtopicsPromptOwn: subtopicsPromptOwn,

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
                });

                let subtopicsGrouped: Record<number, any[]> = {};

                if (withSubtopics) {
                    const topicIds = topics.map(t => t.id);
                    const subtopics = await this.prismaService.subtopic.findMany({
                        where: { topicId: { in: topicIds } },
                        orderBy: { name: 'asc' },
                        select: {
                            id: true,
                            topicId: true,
                            name: true,
                            percent: true,
                            blocked: true,
                        },
                    });

                    subtopicsGrouped = subtopics.reduce((acc, sub) => {
                        if (!acc[sub.topicId]) acc[sub.topicId] = [];
                        acc[sub.topicId].push(sub);
                        return acc;
                    }, {} as Record<number, any[]>);
                }

                const topicsWithPercent = topics.map(topic => {
                    const subtopics = withSubtopics ? subtopicsGrouped[topic.id] || [] : [];
                    const validSubtopics = subtopics.filter(s => !s.blocked);
                    const percent =
                        validSubtopics.length > 0
                            ? validSubtopics.reduce((acc, s) => acc + (s.percent ?? 0), 0) / validSubtopics.length
                            : 0;

                    return {
                        ...topic,
                        percent,
                        subtopics,
                    };
                });

                const validTopics = topicsWithPercent.filter(t => t.subtopics.some(s => !s.blocked));
                const percent =
                    validTopics.length > 0
                        ? validTopics.reduce((acc, t) => acc + t.percent, 0) / validTopics.length
                        : 0;

                enrichedSection = {
                    ...enrichedSection,
                    percent,
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

    async sectionBlocked(
        subjectId: number,
        id: number
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

            if (existingSection.blocked) {
                await this.prismaService.section.update({
                    where: { id, subjectId },
                    data: { blocked: false }
                });

                await this.prismaService.topic.updateMany({
                    where: { sectionId: id, subjectId },
                    data: { blocked: false }
                });

                await this.prismaService.subtopic.updateMany({
                    where: { sectionId: id, subjectId },
                    data: { blocked: false }
                });

                return {
                    statusCode: 200,
                    message: `Dział został pomyślnie odblokowany`,
                };
            }
            else {
                await this.prismaService.section.update({
                    where: { id, subjectId },
                    data: { blocked: true }
                });

                await this.prismaService.topic.updateMany({
                    where: { sectionId: id, subjectId },
                    data: { blocked: true }
                });

                await this.prismaService.subtopic.updateMany({
                    where: { sectionId: id, subjectId },
                    data: { blocked: true }
                });

                return {
                    statusCode: 200,
                    message: `Dział został pomyślnie zablokowany`,
                };
            }
        }
        catch (error) {
            throw new InternalServerErrorException('Błąd podczas aktualizacji dział');
        }
    }
}