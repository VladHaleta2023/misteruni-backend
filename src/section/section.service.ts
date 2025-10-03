import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SectionUpdateRequest } from './dto/section-request.dto';

type Status = 'blocked' | 'started' | 'progress' | 'completed';

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

    addStatusToSections(sections: Section[], threshold: number): Section[] {
        return sections.map(section => {
            const updatedTopics = section.topics.map(topic => {
                if (topic.subtopics && topic.subtopics.length > 0) {
                    const updatedSubtopics = topic.subtopics.map(subtopic => {
                        let status: Status;

                        if (subtopic.blocked === true) {
                            status = 'blocked';
                        } else if (subtopic.percent === 0) {
                            status = 'started';
                        } else if (subtopic.percent < threshold) {
                            status = 'progress';
                        } else {
                            status = 'completed';
                        }

                        return { ...subtopic, status };
                    });

                    const activeSubtopics = updatedSubtopics.filter(st => st.status !== 'blocked');

                    const allStarted = activeSubtopics.every(st => st.status === 'started');
                    const allCompleted = activeSubtopics.every(st => st.status === 'completed');
                    const anyStarted = activeSubtopics.some(st => st.status === 'started');
                    const anyProgress = activeSubtopics.some(st => st.status === 'progress');
                    const anyCompleted = activeSubtopics.some(st => st.status === 'completed');

                    let topicStatus: Status;

                    if (topic.blocked === true || activeSubtopics.length === 0) {
                        topicStatus = 'blocked';
                    } else if (allStarted) {
                        topicStatus = 'started';
                    } else if (anyProgress) {
                        topicStatus = 'progress';
                    } else if (anyStarted && anyCompleted) {
                        topicStatus = 'progress';
                    } else if (allCompleted) {
                        topicStatus = 'completed';
                    } else {
                        topicStatus = 'started';
                    }

                    return { ...topic, subtopics: updatedSubtopics, status: topicStatus };
                } else {
                    const percent = topic.percent ?? 0;
                    let topicStatus: Status;

                    if (topic.blocked === true) {
                        topicStatus = 'blocked';
                    } else if (percent === 0) {
                        topicStatus = 'started';
                    } else if (percent < threshold) {
                        topicStatus = 'progress';
                    } else {
                        topicStatus = 'completed';
                    }

                    return { ...topic, status: topicStatus };
                }
            });

            const activeTopics = updatedTopics.filter(t => t.status !== 'blocked');

            const allStarted = activeTopics.every(t => t.status === 'started');
            const allCompleted = activeTopics.every(t => t.status === 'completed');
            const anyStarted = activeTopics.some(t => t.status === 'started');
            const anyProgress = activeTopics.some(t => t.status === 'progress');
            const anyCompleted = activeTopics.some(t => t.status === 'completed');

            let sectionStatus: Status;

            if (section.blocked === true || activeTopics.length === 0) {
                sectionStatus = 'blocked';
            } else if (allStarted) {
                sectionStatus = 'started';
            } else if (anyProgress) {
                sectionStatus = 'progress';
            } else if (anyStarted && anyCompleted) {
                sectionStatus = 'progress';
            } else if (allCompleted) {
                sectionStatus = 'completed';
            } else {
                sectionStatus = 'started';
            }

            return { ...section, topics: updatedTopics, status: sectionStatus };
        });
    }

    async calculateSubtopicsPercent(
        subjectId: number,
        weekOffset: number = 0,
        updated: boolean = true
    ) {
        const whereClause: any = { subjectId };

        const subtopics = await this.prismaService.subtopic.findMany({
            where: whereClause,
            include: {
                progresses: {
                    where: { task: { finished: true } },
                },
            },
        });

        const now = new Date();
        const day = now.getDay();
        const currentSunday = new Date(now);
        currentSunday.setDate(now.getDate() + (7 - day) + 7 * weekOffset);
        currentSunday.setHours(23, 59, 59, 999);

        const startOfRange = new Date(0);
        const endOfRange = currentSunday;

        const updatedSubtopics = await Promise.all(
            subtopics.map(async (subtopic) => {
                const progresses = subtopic.progresses?.filter(
                    p => p.updatedAt <= endOfRange
                ) || [];

                const percent =
                    progresses.length > 0
                        ? Math.round(progresses.reduce((acc, p) => acc + p.percent, 0) / progresses.length)
                        : 0;

                if (updated) {
                    await this.prismaService.subtopic.update({
                        where: { id: subtopic.id },
                        data: { percent },
                    });
                }

                return { ...subtopic, percent };
            }),
        );

        return updatedSubtopics;
    }

    async calculatePrediction(now: Date, currentMonday: Date, endOfWeek: Date, subjectId: number, subject: any) {
        const endOfWeekFullTime: Date = new Date(now);

        const startOfWeekThenPrediction = new Date(currentMonday);
        startOfWeekThenPrediction.setDate(currentMonday.getDate() - 14);

        const endOfWeekThenPrediction = new Date(startOfWeekThenPrediction);
        endOfWeekThenPrediction.setDate(startOfWeekThenPrediction.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        const daysPrediction = Math.floor(
            (endOfWeekFullTime.getTime() - endOfWeekThenPrediction.getTime()) 
            / (1000 * 60 * 60 * 24)
        );

        const countImportanceFullTimeResult = await this.prismaService.subtopic.aggregate({
            where: { subjectId },
            _sum: {
                importance: true,
            },
        });

        const countImportanceFullTime = (countImportanceFullTimeResult._sum.importance ?? 0) * subject.threshold / 100;

        const subtopicsThenPrediction = await this.calculateSubtopicsPercent(subjectId, -2, false);
        let countImportanceThenPrediction = 0;

        for (const subtopic of subtopicsThenPrediction) {
            const percent = subtopic.percent >= subject.threshold ? subject.threshold : subtopic.percent;
            countImportanceThenPrediction += subtopic.importance * percent / 100;
        }

        const countLeftImportance = countImportanceFullTime - countImportanceThenPrediction;

        let countDeltaImportance = 0;

        const subtopicsFullTime = await this.calculateSubtopicsPercent(subjectId, 0, false);

        for (let i = 0; i < subtopicsFullTime.length; i++) {
            let diff = subtopicsFullTime[i].percent - subtopicsThenPrediction[i].percent;

            if (diff >= subject.threshold)
                diff = subject.threshold;

            countDeltaImportance += countImportanceFullTime * diff / 100;
        }

        let prediction: number | undefined = undefined;

        if (countDeltaImportance != 0)
            prediction = countLeftImportance / countDeltaImportance * daysPrediction;

        const predictionDate = new Date(endOfWeekFullTime);

        const predictionResult = prediction
            ? (() => {
                const date = new Date(predictionDate);
                date.setDate(date.getDate() + Math.ceil(prediction));
                const dd = String(date.getDate()).padStart(2, '0');
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                const yyyy = date.getFullYear();
                return `${dd}.${mm}.${yyyy}`;
            })()
            : "Nieskończoność";

        return predictionResult;
    }

    async findSections(
        subjectId: number,
        withSubject = false,
        withTopics = false,
        withSubtopics = false,
        weekOffset: number = 0
    ) {
        try {
            const subject = await this.prismaService.subject.findUnique({
                where: { id: subjectId },
            });

            if (!subject) {
                throw new BadRequestException('Przedmiot nie został znaleziony');
            }

            const sections = await this.prismaService.section.findMany({
                where: { subjectId },
                orderBy: { partId: 'asc' },
            });

            const resolvePrompts = (section: any) => ({
                subtopicsPrompt: section.subtopicsPrompt?.trim() || subject.subtopicsPrompt || "",
                subtopicsPromptOwn: Boolean(section.subtopicsPrompt?.trim()),

                questionPrompt: section.questionPrompt?.trim() || subject.questionPrompt || "",
                questionPromptOwn: Boolean(section.questionPrompt?.trim()),

                solutionPrompt: section.solutionPrompt?.trim() || subject.solutionPrompt || "",
                solutionPromptOwn: Boolean(section.solutionPrompt?.trim()),

                answersPrompt: section.answersPrompt?.trim() || subject.answersPrompt || "",
                answersPromptOwn: Boolean(section.answersPrompt?.trim()),

                closedSubtopicsPrompt: section.closedSubtopicsPrompt?.trim() || subject.closedSubtopicsPrompt || "",
                closedSubtopicsPromptOwn: Boolean(section.closedSubtopicsPrompt?.trim()),

                subQuestionsPrompt: section.subQuestionsPrompt?.trim() || subject.subQuestionsPrompt || "",
                subQuestionsPromptOwn: Boolean(section.subQuestionsPrompt?.trim()),

                vocabluaryPrompt: section.vocabluaryPrompt?.trim() || subject.vocabluaryPrompt || "",
                vocabluaryPromptOwn: Boolean(section.vocabluaryPrompt?.trim()),
            });

            const allTopics: any[] = [];
            let enrichedSections: any[] = [];

            if (withTopics) {
                let updatedSubtopics = await this.calculateSubtopicsPercent(subjectId, weekOffset);

                if (weekOffset !== 0) {
                    const previousSubtopics = await this.calculateSubtopicsPercent(subjectId, weekOffset - 1, false);

                    const previousMap = new Map<number, typeof previousSubtopics[0]>();
                    previousSubtopics.forEach(sub => previousMap.set(sub.id, sub));

                    updatedSubtopics = updatedSubtopics
                        .map(sub => {
                            const prev = previousMap.get(sub.id);
                            const delta = prev ? sub.percent - prev.percent : 0;
                            return {
                                ...sub,
                                delta
                            };
                        });
                }
                else {
                    updatedSubtopics = updatedSubtopics
                    .map(sub => {
                        const delta = 0;
                        return {
                            ...sub,
                            delta
                        };
                    });
                }

                const topics = await this.prismaService.topic.findMany({
                    where: { subjectId },
                    orderBy: { partId: 'asc' },
                });

                let subtopicsGrouped: Record<number, any[]> = {};

                if (withSubtopics) {
                    subtopicsGrouped = updatedSubtopics.reduce((acc, sub) => {
                        if (!acc[sub.topicId]) acc[sub.topicId] = [];
                        acc[sub.topicId].push(sub);
                        return acc;
                    }, {} as Record<number, any[]>);
                }

                for (const topic of topics) {
                    const subtopics = withSubtopics ? subtopicsGrouped[topic.id] || [] : [];

                    let percent: number = 0;
                    let delta: number = 0;

                    if (subtopics.length > 0) {
                        percent =
                            subtopics.reduce((acc, s) => acc + (s.percent ?? 0), 0) /
                            subtopics.length;
                        const nonZeroDeltas = subtopics.filter(s => (s.delta ?? 0) !== 0);
                        delta =
                        nonZeroDeltas.length > 0
                            ? nonZeroDeltas.reduce((acc, s) => acc + (s.delta ?? 0), 0) / subtopics.length
                            : 0;
                    } else {
                        const now = new Date();
                        const day = now.getDay();
                        const currentSunday = new Date(now);
                        currentSunday.setDate(now.getDate() + (7 - day) + 7 * weekOffset);
                        currentSunday.setHours(23, 59, 59, 999);

                        const startOfRange = new Date(0);
                        const endOfRange = currentSunday;

                        const previousSunday = new Date(now);
                        previousSunday.setDate(now.getDate() + (7 - day) + 7 * (weekOffset - 1));
                        previousSunday.setHours(23, 59, 59, 999);

                        const startOfRangePrevious = new Date(0);
                        const endOfRangePrevious = previousSunday;

                        const tasks = await this.prismaService.task.findMany({
                            where: {
                                topicId: topic.id,
                                finished: true,
                                parentTaskId: null,
                                updatedAt: {
                                    gte: startOfRange,
                                    lte: endOfRange,
                                },
                            },
                            select: { percent: true },
                        });

                        const previousTasks = await this.prismaService.task.findMany({
                            where: {
                                topicId: topic.id,
                                finished: true,
                                parentTaskId: null,
                                updatedAt: {
                                    gte: startOfRangePrevious,
                                    lte: endOfRangePrevious,
                                },
                            },
                            select: { percent: true },
                        });

                        const previousPercent = previousTasks.length > 0
                            ? previousTasks.reduce((acc, t) => acc + (t.percent ?? 0), 0) / previousTasks.length
                            : 0;

                        if (tasks.length > 0) {
                            percent =
                                tasks.reduce((acc, t) => acc + (t.percent ?? 0), 0) /
                                tasks.length;
                            delta = percent - previousPercent
                        } else {
                            percent = 0;
                            delta = 0;
                        }
                    }

                    await this.prismaService.topic.update({
                        where: { id: topic.id },
                        data: { percent },
                    });

                    allTopics.push({ ...topic, subtopics, percent, delta });
                }

                const topicsBySection = allTopics.reduce<Record<number, any[]>>((acc, topic) => {
                    const sectionId = topic.sectionId;
                    if (!acc[sectionId]) acc[sectionId] = [];
                    acc[sectionId].push(topic);
                    return acc;
                }, {});

                enrichedSections = sections
                    .map(section => {
                        const topics = topicsBySection[section.id] || [];
                        if (topics.length === 0) return null;

                        const prompts = resolvePrompts(section);

                        const percent =
                            topics.reduce((acc, t) => acc + t.percent, 0) / topics.length;

                        const nonZeroDeltas = topics.filter(t => (t.delta ?? 0) !== 0);
                        const delta =
                        nonZeroDeltas.length > 0
                            ? nonZeroDeltas.reduce((acc, t) => acc + (t.delta ?? 0), 0) / topics.length
                            : 0;

                        return { ...section, ...prompts, topics, percent, delta };
                    });
            } else {
                enrichedSections = sections.map(section => ({
                    ...section,
                    ...resolvePrompts(section),
                    topics: [],
                    percent: 0,
                    delta: 0
                }));
            }

            const threshold = Number(subject.threshold) || 0;

            const allTopicsWithStatus = allTopics.map(topic => {
                let status: Status;
                const pct = topic.percent ?? 0;

                if (topic.subtopics.length > 0 && topic.subtopics.every(s => s.blocked)) {
                    status = 'blocked';
                } else if (pct === 0) {
                    status = 'started';
                } else {
                    const elements = topic.subtopics.length > 0 ? topic.subtopics : [{ percent: pct }];
                    const allCompleted = elements.every(el => (el.percent ?? 0) >= threshold);

                    if (allCompleted) {
                        status = 'completed';
                    } else {
                        status = 'progress';
                    }
                }
                return { ...topic, status };
            });

            const sectionsWithStatus = enrichedSections.map(section => {
                const topics = section.topics.map((t: any) =>
                    allTopicsWithStatus.find(at => at.id === t.id) || t
                );

                const anyCompleted = topics.some(t => t.status === 'completed');
                const allCompleted = topics.length > 0 && topics.every(t => t.status === 'completed');
                const allBlocked = topics.length > 0 && topics.every(t => t.status === 'blocked');
                const anyInProgress = topics.some(t => t.status === 'progress');

                let status: Status;
                if (allBlocked) status = 'blocked';
                else if (anyCompleted) status = 'completed';
                else if (anyInProgress || anyCompleted) status = 'progress';
                else status = 'started';

                let process: Status;
                if (allCompleted) process = 'completed';
                else if (anyCompleted || anyInProgress) process = 'progress';
                else if (allBlocked) process = 'blocked';
                else process = 'started';

                return { ...section, topics, status, process };
            });

            const counts: Record<Status, number> = { blocked: 0, started: 0, progress: 0, completed: 0 };
            allTopicsWithStatus.forEach(t => counts[t.status]++);

            const totalTopics = allTopicsWithStatus.length || 1;
            const totalPercent: Record<Status, number> = {
                blocked: (counts.blocked / totalTopics) * 100,
                started: (counts.started / totalTopics) * 100,
                progress: (counts.progress / totalTopics) * 100,
                completed: (counts.completed / totalTopics) * 100,
            };

            if (totalPercent.blocked == 0 &&
                totalPercent.started == 0 &&
                totalPercent.progress == 0 &&
                totalPercent.completed == 0)
                totalPercent.started = 100;

            const response: any = {
                statusCode: 200,
                message: 'Działy zostały pomyślnie pobrane',
                sections: sectionsWithStatus,
                total: totalPercent,
                statistics: await this.calculateStatSections(subjectId, weekOffset),
            };

            if (withSubject) {
                response.subject = subject;
            }

            return response;
        } catch (error) {
            throw new InternalServerErrorException('Nie udało się pobrać działów');
        }
    }

    async calculateStatSections(subjectId: number, weekOffset: number = 0) {
        try {
            const subject = await this.prismaService.subject.findUnique({
                where: { id: subjectId },
            });

            if (!subject) {
                throw new BadRequestException('Przedmiot nie został znaleziony');
            }

            if (weekOffset > 0)
                weekOffset = 0;

            const topics = await this.prismaService.topic.findMany({
                where: { subjectId },
                orderBy: { partId: 'asc' },
            });

            const now = new Date();
            const day = now.getDay();
            const currentMonday = new Date(now);
            currentMonday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
            currentMonday.setHours(0, 0, 0, 0);

            const startOfWeek = new Date(currentMonday);
            startOfWeek.setDate(currentMonday.getDate() + 7 * weekOffset);

            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 6);
            endOfWeek.setHours(23, 59, 59, 999);

            const subtopicsNow = await this.calculateSubtopicsPercent(subjectId, weekOffset, false);
            const subtopicsThen = await this.calculateSubtopicsPercent(subjectId, weekOffset - 1, false);

            const groupByTopic = (subtopics: any[]) =>
                subtopics.reduce<Record<number, any[]>>((acc, sub) => {
                    if (!acc[sub.topicId]) acc[sub.topicId] = [];
                    acc[sub.topicId].push(sub);
                    return acc;
                }, {});

            const subtopicsNowByTopic = groupByTopic(subtopicsNow);
            const subtopicsThenByTopic = groupByTopic(subtopicsThen);

            let totalSubtopicsNow = 0;
            let totalSubtopicsThen = 0;
            let totalTopicsNow = 0;
            let totalTopicsThen = 0;

            for (const topic of topics) {
                const nowSubs = subtopicsNowByTopic[topic.id] || [];
                const thenSubs = subtopicsThenByTopic[topic.id] || [];

                const closedNowSubs = nowSubs.filter(sub => sub.percent >= subject.threshold);
                const closedThenSubs = thenSubs.filter(sub => sub.percent >= subject.threshold);

                totalSubtopicsNow += closedNowSubs.length;
                totalSubtopicsThen += closedThenSubs.length;

                if (nowSubs.length > 0 && closedNowSubs.length === nowSubs.length) totalTopicsNow += 1;
                if (thenSubs.length > 0 && closedThenSubs.length === thenSubs.length) totalTopicsThen += 1;
            }

            const formatDate = (date: Date) => {
                const dd = String(date.getDate()).padStart(2, '0');
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                return `${dd}.${mm}`;
            };

            const startDateStr = formatDate(startOfWeek);
            const endDateStr = formatDate(endOfWeek);

            let startOfWeekTask: Date;
            let endOfWeekTask: Date;
            let predictionResult: string | null = null;

            if (weekOffset === 0) {
                predictionResult = await this.calculatePrediction(now, currentMonday, endOfWeek, subjectId, subject);
                startOfWeekTask = new Date(0);
                endOfWeekTask = new Date(now);
            } else {
                const day = now.getDay();
                const currentMonday = new Date(now);
                currentMonday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
                currentMonday.setHours(0, 0, 0, 0);

                startOfWeekTask = new Date(currentMonday);
                startOfWeekTask.setDate(currentMonday.getDate() + 7 * weekOffset);

                endOfWeekTask = new Date(startOfWeekTask);
                endOfWeekTask.setDate(startOfWeekTask.getDate() + 6);
                endOfWeekTask.setHours(23, 59, 59, 999);
            }

            const solvedTasksCount = await this.prismaService.task.count({
                where: {
                    finished: true,
                    parentTaskId: null,
                    updatedAt: {
                        gte: startOfWeekTask,
                        lte: endOfWeekTask,
                    },
                    topic: {
                        subjectId: subjectId,
                    },
                },
            });

            const solvedTasksCountCompleted = await this.prismaService.task.count({
                where: {
                    finished: true,
                    parentTaskId: null,
                    updatedAt: {
                        gte: startOfWeekTask,
                        lte: endOfWeekTask,
                    },
                    percent: {
                        gte: subject.threshold,
                    },
                    topic: {
                        subjectId: subjectId,
                    },
                },
            });

            let weekLabel = "bieżący" 
            if (weekOffset < 0)
                weekLabel = `${weekOffset} tydz.`

            return {
                solvedTasksCount,
                solvedTasksCountCompleted,
                closedSubtopicsCount: totalSubtopicsNow - totalSubtopicsThen,
                closedTopicsCount: totalTopicsNow - totalTopicsThen,
                startDateStr,
                weekLabel,
                endDateStr,
                prediction: predictionResult
            };
        } catch (error) {
            return {
                solvedTasksCountCompleted: 0,
                solvedTasksCount: 0,
                closedSubtopicsCount: 0,
                closedTopicsCount: 0,
                startDateStr: '',
                endDateStr: '',
                weekLabel: '',
                prediction: null
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