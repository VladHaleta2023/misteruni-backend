import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DateUtils } from '../scripts/dateUtils';
import { SectionUpdateRequest } from '../section/dto/section-request.dto';
import { TimezoneService } from '../timezone/timezone.service';

type Status = 'started' | 'progress' | 'completed';
type DeltaStatus = 'completed' | 'error' | 'completed error';

@Injectable()
export class SectionService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly timezoneService: TimezoneService
    ) {}

    private calculateSectionsWithStatus(enrichedSections: any[], threshold: number) {
        return enrichedSections.map(section => {
            let status: Status = "started";

            if (section.percent == 0)
                status = "started";
            else if (section.percent >= threshold)
                status = "completed";
            else
                status = "progress";

            return { ...section, status };
        });
    }

    async calculateSubtopicsPercent(subjectId: number, weekOffset = 0) {
        const now = new Date();
        
        let endOfRange: Date;
        
        if (weekOffset === 0) {
            endOfRange = new Date();
            if (now.getDay() === 0) {
                endOfRange.setHours(23, 59, 59, 999);
            }
        } else {
            endOfRange = DateUtils.getSunday(now, weekOffset);
            endOfRange.setHours(23, 59, 59, 999);
        }

        const endOfRangeUTC = this.timezoneService.localToUTC(endOfRange);

        const subtopics = await this.prismaService.subtopic.findMany({
            where: { subjectId },
            include: {
                progresses: {
                    where: {
                        updatedAt: { lte: endOfRangeUTC },
                        task: { finished: true },
                    },
                    include: { task: { select: { id: true } } },
                    orderBy: { updatedAt: 'asc' },
                },
            },
        });

        const updatedSubtopics = subtopics.map(subtopic => {
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
                    if (emaValue === null) {
                        emaValue = currentPercent;
                    } else {
                        emaValue = (emaValue * (1 - alpha)) + (currentPercent * alpha);
                    }
                }
                percent = Math.min(100, Math.ceil(emaValue!));
            }
            
            return { ...subtopic, percent };
        });

        return updatedSubtopics;
    }

    async calculatePrediction(
        now: Date,
        subjectId: number,
        subject: any,
        subtopicsNow: any[],
        frequencyThreshold: number = 0,
        globalCompression: number = 1.8
    ): Promise<string> {
        try {
            let topics = await this.prismaService.topic.findMany({
                where: { subjectId },
                include: { subtopics: true },
                orderBy: { partId: 'asc' },
            });

            if (topics.length === 0) return 'Infinity';
            
            const filteredTopics = topics.filter(topic => topic.frequency >= frequencyThreshold);

            topics = filteredTopics.length > 0 ? filteredTopics : topics;

            const subtopicIds = topics.flatMap(t => t.subtopics.map(s => s.id));
            if (subtopicIds.length === 0) return 'Infinity';

            let totalWeight = 0;
            let currentWeight = 0;

            for (const topic of topics) {
                const subtopicImportances = topic.subtopics.map(s => s.importance || 0);
                if (subtopicImportances.length === 0) continue;

                const minImp = Math.min(...subtopicImportances);
                const maxImp = Math.max(...subtopicImportances);
                const normalizedDifficulties = topic.subtopics.map(s =>
                    maxImp === minImp ? 1 : ((s.importance || 0) - minImp) / (maxImp - minImp)
                );

                const avgNormalizedDifficulty =
                    normalizedDifficulties.reduce((sum, d) => sum + d, 0) / normalizedDifficulties.length;

                const compressedDifficulty = Math.min(avgNormalizedDifficulty * globalCompression, 1);

                const avgSubtopicPercent =
                    topic.subtopics.reduce((sum, s, idx) => {
                        const progress = subtopicsNow.find(x => x.id === s.id)?.percent || 0;
                        return sum + (Math.min(100, progress) / 100) * normalizedDifficulties[idx];
                    }, 0) / topic.subtopics.length;

                const topicPercent = subject.threshold > 0 
                    ? Math.min(avgSubtopicPercent / (subject.threshold / 100), 1)
                    : Math.min(avgSubtopicPercent, 1);

                const normalizedFrequency = Math.min((topic.frequency / 100) * globalCompression, 1);

                const topicCurrentWeight = compressedDifficulty * topicPercent * normalizedFrequency;
                const topicTotalWeight = compressedDifficulty * (Math.max(0.1, subject.threshold / 100)) * normalizedFrequency;

                currentWeight += topicCurrentWeight;
                totalWeight += topicTotalWeight;
            }

            if (totalWeight <= 0 || currentWeight <= 0) {
                return 'Infinity';
            }

            const firstProgress = await this.prismaService.subtopicProgress.findFirst({
                where: { 
                    subtopicId: { in: subtopicIds },
                    percent: { gt: 0 }
                },
                select: { updatedAt: true },
                orderBy: { updatedAt: 'asc' },
            });

            const learningStartDate = firstProgress?.updatedAt || new Date();

            const nowUTC = this.timezoneService.localToUTC(now);
            const learningStartDateUTC = this.timezoneService.localToUTC(learningStartDate);

            const learningPeriodDays = Math.max(
                1,
                Math.floor((nowUTC.getTime() - learningStartDateUTC.getTime()) / (1000 * 60 * 60 * 24))
            );

            const learningSpeed = currentWeight / learningPeriodDays;
            const remainingWeight = Math.max(0, totalWeight - currentWeight);

            const MINIMAL_LEARNING_SPEED = 0.001;
            
            let predictionDays: number;
            if (learningSpeed > MINIMAL_LEARNING_SPEED) {
                predictionDays = remainingWeight / learningSpeed;
                predictionDays = Math.max(1, predictionDays);
            } else {
                const conservativeSpeed = Math.max(MINIMAL_LEARNING_SPEED, currentWeight / 7);
                predictionDays = remainingWeight / conservativeSpeed;
                predictionDays = Math.max(7, predictionDays);
            }

            const resultDate = new Date(now);
            resultDate.setDate(resultDate.getDate() + Math.ceil(predictionDays));

            const localResultDate = this.timezoneService.utcToLocal(resultDate);
            const dd = String(localResultDate.getDate()).padStart(2, '0');
            const mm = String(localResultDate.getMonth() + 1).padStart(2, '0');
            const yyyy = localResultDate.getFullYear();

            return `${dd}.${mm}.${yyyy}`;
        } catch (error) {
            console.error('Prediction calculation error:', error);
            return 'Infinity';
        }
    }

    private async batchCalculateTopicPercents(topics: any[], weekOffset: number) {
        if (topics.length === 0) return [];

        const topicIds = topics.map(t => t.id);
        const now = new Date();
        
        let endOfRange: Date;
        
        if (weekOffset === 0) {
            endOfRange = new Date();
            if (now.getDay() === 0) {
                endOfRange.setHours(23, 59, 59, 999);
            }
        } else {
            endOfRange = DateUtils.getSunday(now, weekOffset);
            endOfRange.setHours(23, 59, 59, 999);
        }

        const endOfRangePrevious = DateUtils.getSunday(now, weekOffset - 1);
        endOfRangePrevious.setHours(23, 59, 59, 999);

        const endOfRangeUTC = this.timezoneService.localToUTC(endOfRange);
        const endOfRangePreviousUTC = this.timezoneService.localToUTC(endOfRangePrevious);

        const [currentTasks, previousTasks] = await Promise.all([
            this.prismaService.task.findMany({
                where: {
                    topicId: { in: topicIds },
                    finished: true,
                    parentTaskId: null,
                    updatedAt: { lte: endOfRangeUTC },
                },
                select: { topicId: true, percent: true },
            }),
            this.prismaService.task.findMany({
                where: {
                    topicId: { in: topicIds },
                    finished: true,
                    parentTaskId: null,
                    updatedAt: { lte: endOfRangePreviousUTC },
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
                ? Math.min(100, tasks.reduce((acc, t) => acc + t.percent, 0) / tasks.length)
                : 0;

            const previousPercent = prevTasks.length > 0
                ? Math.min(100, prevTasks.reduce((acc, t) => acc + t.percent, 0) / prevTasks.length)
                : 0;

            const delta = percent - previousPercent;

            return { id: topic.id, percent, delta };
        });
    }

    private calculateTopicStatus(percent: number, threshold: number): Status {
        if (percent === 0)
            return 'started';
        else if (percent >= threshold)
            return 'completed';
        else
            return 'progress'
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
            percent: Math.min(100, sub.percent),
            delta: weekOffset !== 0 ? (Math.min(100, sub.percent) - Math.min(100, previousMap.get(sub.id)?.percent || 0)) : 0
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
            topicsWithCalculatedPercents.map(t => [t.id, {
                ...t,
                percent: Math.min(100, t.percent),
                delta: Math.max(-100, Math.min(100, t.delta))
            }])
        );

        const allTopics = topicsFromDB.map(topic => {
            const subtopics = withSubtopics ? (subtopicsGrouped[topic.id] || []) : [];
            
            let percent = 0;
            let delta = 0;

            if (subtopics.length > 0) {
                const totalPercent = subtopics.reduce((acc, s) => acc + Math.min(100, s.percent), 0);
                percent = totalPercent / subtopics.length;
                
                const validDeltas = subtopics
                    .filter(s => s.delta !== 0)
                    .map(s => Math.max(-100, Math.min(100, s.delta ?? 0)));
                
                delta = validDeltas.length > 0 
                    ? validDeltas.reduce((acc, d) => acc + d, 0) / validDeltas.length 
                    : 0;
            } else {
                const calculated = topicPercentMap.get(topic.id);
                if (calculated) {
                    percent = Math.min(100, calculated.percent);
                    delta = Math.max(-100, Math.min(100, calculated.delta));
                }
            }

            percent = Math.min(100, Math.ceil(percent));
            const deltaStatus: DeltaStatus = delta >= 0 ? 'completed' : 'error';

            return { 
                ...topic, 
                subtopics, 
                percent, 
                delta, 
                deltaStatus,
                status: this.calculateTopicStatus(percent, threshold)
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

                const totalPercent = topics.reduce((acc, t) => acc + Math.min(100, t.percent), 0);
                const percent = Math.min(100, Math.ceil(totalPercent / topics.length));
                
                const validDeltas = topics
                    .filter(t => t.delta !== 0)
                    .map(t => Math.max(-100, Math.min(100, t.delta ?? 0)));
                
                const delta = validDeltas.length > 0
                    ? validDeltas.reduce((acc, d) => acc + d, 0) / validDeltas.length
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
        let sumPercentProgress = 0;

        sectionsWithStatus.forEach(section => {
            const p = Math.min(100, section.percent ?? 0);

            if (section.status === "completed")
                sumPercentCompleted += p;
            else if (section.status === "progress")
                sumPercentProgress += p;
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

            const HIGH_FREQUENCY_THRESHOLD = 70;
            const MEDIUM_FREQUENCY_THRESHOLD = 40;
            const HIGH_FREQ_REPEAT_DAYS = 30;
            const MEDIUM_FREQ_REPEAT_DAYS = 60;

            const getFullCalendarDaysDiff = (lastTaskDate: Date): number => {
                return this.timezoneService.getDaysDifference(lastTaskDate);
            };

            let lastTaskDates = new Map<number, Date>();
            if (withTopics) {
                const startOfTodayUTC = this.timezoneService.getStartOfTodayUTC();

                const lastTasks = await this.prismaService.task.findMany({
                    where: {
                        topic: { subjectId },
                        finished: true,
                        updatedAt: {
                            lt: startOfTodayUTC
                        }
                    },
                    select: {
                        topicId: true,
                        updatedAt: true,
                    },
                    orderBy: {
                        updatedAt: 'desc',
                    },
                });

                lastTaskDates = lastTasks.reduce((map, task) => {
                    if (!map.has(task.topicId) || task.updatedAt > map.get(task.topicId)!) {
                        map.set(task.topicId, task.updatedAt);
                    }
                    return map;
                }, new Map<number, Date>());
            }

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

                enrichedSections = enrichedSections.map(section => ({
                    ...section,
                    topics: section.topics.map(topic => {
                        const lastTaskDate = lastTaskDates.get(topic.id);
                        let repeat = false;
                        let daysDiff = 0;

                        if (lastTaskDate) {
                            daysDiff = getFullCalendarDaysDiff(lastTaskDate);
                            
                            if (topic.frequency >= HIGH_FREQUENCY_THRESHOLD) {
                                repeat = daysDiff >= HIGH_FREQ_REPEAT_DAYS;
                            } else if (topic.frequency >= MEDIUM_FREQUENCY_THRESHOLD) {
                                repeat = daysDiff >= MEDIUM_FREQ_REPEAT_DAYS;
                            }
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
            } else {
                enrichedSections = sections.map(section => ({
                    ...section,
                    topics: [],
                    percent: 0,
                    delta: 0,
                    deltaStatus: 'completed',
                    repeat: false,
                }));
            }

            const sectionsWithStatus = this.calculateSectionsWithStatus(enrichedSections, subject.threshold);
            
            const [statistics, totalPercent] = await Promise.all([
                this.calculateStatSections(subjectId, weekOffset, updatedSubtopics, previousSubtopics),
                Promise.resolve(this.calculateTotalPercent(sectionsWithStatus))
            ]);

            const sectionsWithRepeat = sectionsWithStatus.map(section => ({
                ...section,
                repeat: section.topics?.some(topic => topic.repeat) || false,
            }));

            const response: any = {
                statusCode: 200,
                message: 'Działy zostały pomyślnie pobrane',
                sections: sectionsWithRepeat,
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
            
            let startOfRange: Date;
            let endOfRange: Date;
            
            if (weekOffset === 0) {
                startOfRange = DateUtils.getMonday(now, 0);
                endOfRange = new Date();
                if (now.getDay() === 0) {
                    endOfRange = DateUtils.getSunday(now, 0);
                    endOfRange.setHours(23, 59, 59, 999);
                }
            } else {
                startOfRange = DateUtils.getMonday(now, weekOffset);
                endOfRange = DateUtils.getSunday(now, weekOffset);
                endOfRange.setHours(23, 59, 59, 999);
            }

            const startOfRangeUTC = this.timezoneService.localToUTC(startOfRange);
            const endOfRangeUTC = this.timezoneService.localToUTC(endOfRange);

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
                const closedNow = nowSubs.filter(sub => Math.min(100, sub.percent) >= subject.threshold);
                const closedThen = thenSubs.filter(sub => Math.min(100, sub.percent) >= subject.threshold);

                totalSubsNow += closedNow.length;
                totalSubsThen += closedThen.length;
                if (nowSubs.length && closedNow.length === nowSubs.length) totalTopicsNow++;
                if (thenSubs.length && closedThen.length === thenSubs.length) totalTopicsThen++;
            }

            const formatDate = (d: Date) => {
                const localDate = this.timezoneService.utcToLocal(d);
                return `${String(localDate.getDate()).padStart(2, '0')}.${String(localDate.getMonth() + 1).padStart(2, '0')}`;
            };

            let predictionResult: string | null = null;

            if (weekOffset === 0) {
                predictionResult = await this.calculatePrediction(
                    now,
                    subjectId,
                    subject,
                    subtopicsNow
                );
            }

            const solvedTasksCount = await this.prismaService.task.count({
                where: {
                    finished: true,
                    parentTaskId: null,
                    updatedAt: { gte: startOfRangeUTC, lte: endOfRangeUTC },
                    topic: { subjectId },
                },
            });

            const solvedTasksCountCompleted = await this.prismaService.task.count({
                where: {
                    finished: true,
                    parentTaskId: null,
                    updatedAt: { gte: startOfRangeUTC, lte: endOfRangeUTC },
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
                startDateStr: formatDate(startOfRange),
                endDateStr: formatDate(endOfRange),
                weekLabel,
                prediction: predictionResult
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
                dayPrediction: null
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
            const topicExpansionPromptOwn = Boolean(section.topicExpansionPrompt && section.topicExpansionPrompt.trim() !== "");

            const prompts = {
                topicExpansionPrompt: topicExpansionPromptOwn ? section.topicExpansionPrompt.trim() : (subject.topicExpansionPrompt || ""),
                topicExpansionPromptOwn: topicExpansionPromptOwn,

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
}