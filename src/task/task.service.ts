import { HttpService } from '@nestjs/axios';
import { BadRequestException, HttpException, HttpStatus, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InteractiveTaskAIGenerate, OptionsAIGenerate, ProblemsAIGenerate, QuestionsTaskAIGenerate, SolutionAIGenerate, TaskAIGenerate, VocabluaryAIGenerate } from './dto/task-generate.dto';
import { firstValueFrom } from 'rxjs';
import { SubtopicService } from '../subtopic/subtopic.service';
import { SubtopicsProgressUpdateRequest, TaskCreateRequest, TaskUserSolutionRequest } from './dto/task-request.dto';
import { OptionsService } from '../options/options.service';
import { ConfigService } from '@nestjs/config';
import { DateUtils } from '../scripts/dateUtils';
import { TimezoneService } from '../timezone/timezone.service';
import { StorageService } from 'src/storage/storage.service';

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
        private readonly configService: ConfigService,
        private readonly timezoneService: TimezoneService
    ) {
        const node_env = this.configService.get<string>('APP_ENV') || 'development';

        if (node_env === 'development') {
            this.fastapiUrl = this.configService.get<string>('FASTAPI_URL_LOCAL') || undefined;
        }
        else {
            this.fastapiUrl = this.configService.get<string>('FASTAPI_URL') || undefined;
        }
    }

    async calculateSubtopicsPercent(
        userId: number,
        subjectId: number,
        sectionId?: number,
        topicId?: number,
    ) {
        const whereClause: any = { subjectId };
        if (sectionId) whereClause.sectionId = sectionId;
        if (topicId) whereClause.topicId = topicId;

        const subtopics = await this.prismaService.subtopic.findMany({
            where: whereClause,
            include: {
                progresses: {
                    where: {
                        userId,
                        task: { finished: true, userId }
                    },
                },
            },
        });

        const updatedSubtopics = await Promise.all(
            subtopics.map(async (subtopic) => {
                const progresses = subtopic.progresses || [];
                const percent =
                    progresses.length > 0
                        ? Math.round(progresses.reduce((acc, p) => acc + p.percent, 0) / progresses.length)
                        : 0;

                return { ...subtopic, percent };
            }),
        );

        return updatedSubtopics;
    }

    async findTasks(
        userId: number,
        subjectId: number,
        sectionId: number,
        topicId: number,
        weekOffset: number = 0
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

            const userSubject = await this.prismaService.userSubject.findUnique({
                where: {
                    userId_subjectId: {
                        userId: userId,
                        subjectId: subjectId
                    }
                },
                select: {
                    threshold: true,
                    detailLevel: true
                }
            });

            const threshold = userSubject?.threshold ?? 50;

            const subtopics = await this.prismaService.subtopic.findMany({
                where: { topicId: topicId },
                include: {
                    progresses: {
                        where: {
                            userId,
                            task: { finished: true, userId }
                        },
                        select: {
                            percent: true,
                            updatedAt: true,
                        },
                        orderBy: { updatedAt: 'asc' }
                    }
                }
            });

            const subtopicsWithStatus = subtopics.map(subtopic => {
                const progresses = subtopic.progresses;
                
                let percent = 0;
                const alpha = 0.7;
                
                if (progresses.length > 0) {
                    let emaValue: number | null = null;
                    for (const progress of progresses) {
                        const currentPercent = Math.min(100, progress.percent);
                        
                        if (emaValue === null) {
                            emaValue = currentPercent;
                        } else {
                            emaValue = (emaValue * (1 - alpha)) + (currentPercent * alpha);
                        }
                    }
                    percent = Math.min(100, Math.ceil(emaValue!));
                }
                
                let subtopicStatus: Status;
                if (percent === 0) {
                    subtopicStatus = 'started';
                } else if (percent < threshold) {
                    subtopicStatus = 'progress';
                } else {
                    subtopicStatus = 'completed';
                }
                
                return {
                    ...subtopic,
                    percent,
                    status: subtopicStatus
                };
            });

            let averagePercent = 0;
            let topicStatus: Status = 'started';

            if (subtopics.length > 0) {
                averagePercent = Math.ceil(
                    subtopicsWithStatus.reduce((sum, st) => sum + st.percent, 0) / 
                    subtopicsWithStatus.length
                );
                
                if (averagePercent === 0) {
                    topicStatus = 'started';
                } else if (averagePercent < threshold) {
                    topicStatus = 'progress';
                } else {
                    topicStatus = 'completed';
                }
            }
            else {
                const tasksForPercent = await this.prismaService.task.findMany({
                    where: {
                        userId,
                        topicId,
                        parentTaskId: null,
                        finished: true,
                    },
                    select: {
                        percent: true,
                    },
                });

                if (tasksForPercent.length > 0) {
                    averagePercent = Math.min(
                        100, 
                        Math.ceil(
                            tasksForPercent.reduce((sum, task) => sum + task.percent, 0) / 
                            tasksForPercent.length
                        )
                    );
                }
                
                if (averagePercent === 0) {
                    topicStatus = 'started';
                } else if (averagePercent < threshold) {
                    topicStatus = 'progress';
                } else {
                    topicStatus = 'completed';
                }
            }

            const now = new Date();
            let dateFilter: any = undefined;

            if (weekOffset !== 0) {
                const startOfWeek = DateUtils.getMonday(now, weekOffset);
                const endOfWeek = DateUtils.getSunday(now, weekOffset);
                
                const startOfWeekUTC = this.timezoneService.localToUTC(startOfWeek);
                const endOfWeekUTC = this.timezoneService.localToUTC(endOfWeek);
                
                dateFilter = {
                    gte: startOfWeekUTC,
                    lte: endOfWeekUTC,
                };
            }

            const tasks = await this.prismaService.task.findMany({
                where: {
                    userId,
                    topicId,
                    parentTaskId: null,
                    ...(dateFilter ? { updatedAt: dateFilter } : {}),
                },
                orderBy: [
                    { updatedAt: 'desc' },
                    { order: 'asc' },
                ],
            });

            const tasksWithPercent = await Promise.all(
                tasks.map(async task => {
                    let status: Status = "started";

                    if (task.percent === 0) {
                        status = 'started';
                    } else if (task.percent < threshold) {
                        status = 'progress';
                    } else {
                        status = 'completed';
                    }

                    const words = await this.prismaService.word.findMany({
                        where: {
                            userId,
                            tasks: {
                                some: {
                                    taskId: task.id,
                                },
                            },
                        },
                    });

                    const progresses = await this.prismaService.subtopicProgress.findMany({
                        where: {
                            userId,
                            taskId: task.id,
                        },
                        include: {
                            subtopic: {
                                select: {
                                    name: true,
                                },
                            },
                        },
                    });

                    const subtopics = progresses
                        .filter(progress => progress.subtopic !== null)
                        .map(progress => progress.subtopic.name);

                    const vocabluary = words.length > 0 && words.every(word => word.streakCorrectCount >= 3);

                    return {
                        ...task,
                        status,
                        vocabluary: vocabluary,
                        wordsCount: words.length,
                        subtopics,
                        topic: {
                            id: topic.id,
                            name: topic.name,
                        },
                        section: {
                            id: section.id,
                            name: section.name,
                            type: section.type
                        }
                    };
                })
            );

            const groupedTasksMap: Record<string, typeof tasksWithPercent> = {};
            tasksWithPercent.forEach(task => {
                const localUpdated = this.timezoneService.utcToLocal(task.updatedAt);
                const day = String(localUpdated.getDate()).padStart(2, '0');
                const month = String(localUpdated.getMonth() + 1).padStart(2, '0');
                const year = localUpdated.getFullYear();
                const dateKey = `${day}-${month}-${year}`;

                if (!groupedTasksMap[dateKey]) groupedTasksMap[dateKey] = [];
                groupedTasksMap[dateKey].push(task);
            });

            const groupedTasks = Object.entries(groupedTasksMap).map(([dateKey, tasks]) => {
                const [day, month, year] = dateKey.split('-');
                return {
                    date: { day, month, year },
                    tasks,
                };
            });

            return {
                statusCode: 200,
                message: 'Pobrano listę zadań pomyślnie',
                elements: groupedTasks,
                topic: {
                    ...topic,
                    percent: averagePercent,
                    status: topicStatus,
                    subtopics: subtopicsWithStatus
                }
            };

        } catch (error) {
            throw new InternalServerErrorException('Nie udało się pobrać listy zadań');
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

            const userSubject = await this.prismaService.userSubject.findUnique({
                where: {
                    userId_subjectId: {
                        userId: userId,
                        subjectId: subjectId
                    }
                },
                select: {
                    threshold: true,
                    detailLevel: true
                }
            });

            const threshold = userSubject?.threshold ?? 50;

            if (!topic) throw new BadRequestException('Temat nie został znaleziony');

            const task = await this.prismaService.task.findUnique({
                where: {
                    userId,
                    id
                },
                include: {
                    words: { include: { word: true } },
                    progresses: { include: { subtopic: true } },
                    audioFiles: true,
                    subTasks: {
                        include: {
                            progresses: { include: { subtopic: true } },
                            audioFiles: true,
                        },
                        orderBy: { order: 'asc' },
                    },
                },
            });

            if (!task) throw new BadRequestException('Zadanie nie zostało znalezione');

            let status: Status = "started";
            if (task.percent === 0) status = "started";
            else if (task.percent >= threshold) status = "completed";
            else status = "progress";

            const taskSubtopics = task.progresses.map(p => ({
                name: p.subtopic.name,
                percent: p.percent,
            }));

            const subTasksWithSubtopics = task.subTasks.map(sub => {
                const subSubtopics = sub.progresses?.map(p => ({
                    name: p.subtopic.name,
                    percent: p.percent,
                })) || [];

                const { progresses, audioFiles, ...subTaskData } = sub;

                return {
                    ...subTaskData,
                    subtopics: subSubtopics,
                    audioFiles: audioFiles.map(f => f.url),
                };
            });

            const { progresses, subTasks, audioFiles, words, ...taskData } = task;

            const sanitizedWords = task.words
            .map(tw => tw.word)
            .filter(w => w.topicId !== null)
            .map(w => ({
                id: w.id,
                text: w.text,
                finished: w.finished,
                createdAt: w.createdAt,
                updatedAt: w.updatedAt,
                topicId: w.topicId,
                streakCorrectCount: w.streakCorrectCount,
                totalAttemptCount: w.totalAttemptCount,
                totalCorrectCount: w.totalCorrectCount,
            }));

            const taskWithSubtopics = {
                ...taskData,
                topicNote: topic.note,
                status: status,
                subtopics: taskSubtopics,
                words: sanitizedWords,
                audioFiles: audioFiles.map(f => f.url),
                subTasks: subTasksWithSubtopics,
            };

            return {
                statusCode: 200,
                message: 'Pobrano ostatnie zakończone zadanie pomyślnie',
                task: taskWithSubtopics,
            };
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

                        const userSubject = await this.prismaService.userSubject.findUnique({
                where: {
                    userId_subjectId: {
                        userId: userId,
                        subjectId: subjectId
                    }
                },
                select: {
                    threshold: true,
                    detailLevel: true
                }
            });

            const threshold = userSubject?.threshold ?? 50;

            const task = await this.prismaService.task.findFirst({
                where: {
                    userId,
                    topicId,
                    finished: false,
                    parentTask: null,
                },
                include: {
                    words: {
                        include: { word: true }
                    },
                    progresses: { include: { subtopic: true } },
                    audioFiles: true,
                    subTasks: {
                        include: {
                            progresses: { include: { subtopic: true } },
                            audioFiles: true,
                        },
                        orderBy: { order: 'asc' },
                    },
                },
                orderBy: { order: 'asc' },
            });

            if (!task) {
                return {
                    statusCode: 200,
                    message: 'Brak zadań do pobrania',
                    task: null,
                };
            }

            let status: Status = "started";
            if (task.percent === 0) status = "started";
            else if (task.percent >= threshold) status = "completed";
            else status = "progress";

            const taskSubtopics = task.progresses.map(p => ({
                name: p.subtopic.name,
                percent: p.percent,
            }));

            const subTasksWithSubtopics = task.subTasks.map(sub => {
                const subSubtopics = sub.progresses?.map(p => ({
                    name: p.subtopic.name,
                    percent: p.percent,
                })) || [];

                const { progresses, ...subTaskData } = { ...sub, subtopics: subSubtopics };
                return subTaskData;
            });

            const { progresses, subTasks, audioFiles, words, ...taskData } = task;

            const sanitizedWords = task.words
            .map(tw => tw.word)
            .filter(w => w.topicId !== null)
            .map(w => ({
                id: w.id,
                text: w.text,
                finished: w.finished,
                createdAt: w.createdAt,
                updatedAt: w.updatedAt,
                topicId: w.topicId,
                streakCorrectCount: w.streakCorrectCount,
                totalAttemptCount: w.totalAttemptCount,
                totalCorrectCount: w.totalCorrectCount,
            }));

            const taskWithSubtopicsAndUrls = {
                ...taskData,
                topicNote: topic.note,
                status: status,
                subtopics: taskSubtopics,
                words: sanitizedWords,
                audioFiles: audioFiles.map(f => f.url),
                subTasks: subTasksWithSubtopics.map(sub => ({
                    ...sub,
                    audioFiles: sub.audioFiles.map(f => f.url),
                })),
            };

            return {
                statusCode: 200,
                message: 'Pobrano ostatnie zadanie pomyślnie',
                task: taskWithSubtopicsAndUrls,
            };
        } catch (error) {
            console.error('findPendingTask error:', error);
            throw new InternalServerErrorException('Nie udało się pobrać ostatniego zadania');
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
            if (!topic) throw new BadRequestException('Temat nie został znalezione');

            const userSubject = await this.prismaService.userSubject.findUnique({
                where: {
                    userId_subjectId: {
                        userId: userId,
                        subjectId: subjectId
                    }
                },
                select: {
                    threshold: true,
                    detailLevel: true
                }
            });

            const threshold = userSubject?.threshold ?? 50;

            let subtopicsWithAvg: { name: string; percent: number; importance: number }[] = [];

            if (data.mode === "strict" && data.taskId) {
                const existingTask = await this.prismaService.task.findUnique({
                    where: {
                        userId,
                        id: data.taskId
                    },
                    include: {
                        progresses: {
                            where: {
                                userId
                            },
                            include: {
                                subtopic: {
                                    include: {
                                        progresses: {
                                            where: {
                                                userId
                                            },
                                            select: { percent: true },
                                        },
                                    },
                                },
                            },
                        },
                    },
                });

                if (!existingTask) {
                    throw new BadRequestException('Zadanie o podanym taskId nie zostało znalezione');
                }

                const uniqueSubtopics = new Map<number, {
                    name: string;
                    importance: number;
                    progresses: { percent: number }[];
                }>();

                for (const prog of existingTask.progresses) {
                    const st = prog.subtopic;
                    if (!uniqueSubtopics.has(st.id)) {
                        uniqueSubtopics.set(st.id, {
                            name: st.name,
                            importance: st.importance,
                            progresses: st.progresses,
                        });
                    }
                }

                const alpha = 0.7;
                subtopicsWithAvg = Array.from(uniqueSubtopics.values()).map(st => {
                    let percent = 0;

                    if (st.progresses.length > 0) {
                        let emaValue: number | null = null;

                        for (const p of st.progresses) {
                            const currentPercent = Math.min(100, p.percent);

                            if (emaValue === null) {
                                emaValue = currentPercent;
                            } else {
                                emaValue = (emaValue * (1 - alpha)) + (currentPercent * alpha);
                            }
                        }

                        percent = Math.min(100, Math.ceil(emaValue!));
                    }

                    return {
                        name: st.name,
                        percent,
                        importance: st.importance,
                    };
                });
            }
            else {
                const subtopics = await this.prismaService.subtopic.findMany({
                    where: { topicId },
                    include: {
                        progresses: {
                            where: { userId },
                            select: { percent: true },
                        },
                    },
                });

                const allWithAvg = subtopics.map(subtopic => {
                    const avgPercent = subtopic.progresses.length > 0
                        ? subtopic.progresses.reduce((sum, p) => sum + p.percent, 0) / subtopic.progresses.length
                        : 0;

                    return {
                        name: subtopic.name,
                        percent: avgPercent,
                        importance: subtopic.importance,
                    };
                });

                const belowThreshold = allWithAvg.filter(s => s.percent < threshold);

                subtopicsWithAvg = belowThreshold.length > 0 ? belowThreshold : allWithAvg;
            }

            const filtered = subtopicsWithAvg.map(s => [s.name, s.percent, s.importance] as [string, number, number]);
            filtered.sort((a, b) => {
                return a[2] - b[2];
            });

            data.subtopics = data.subtopics ?? filtered;
            data.subject = data.subject ?? subject.name;
            data.section = data.section ?? section.name;
            data.topic = data.topic ?? topic.name;
            data.literature = data.literature ?? topic.literature;
            data.threshold = data.threshold ?? threshold;

            const resolvedQuestionPrompt =
                topic.questionPrompt?.trim()
                    ? topic.questionPrompt
                    : section.questionPrompt?.trim()
                    ? section.questionPrompt
                    : subject.questionPrompt ?? null;

            data.prompt = resolvedQuestionPrompt;

            if (!Array.isArray(data.subtopics) || !data.subtopics.every(item =>
                Array.isArray(item) &&
                item.length === 3 &&
                typeof item[0] === 'string' &&
                typeof item[1] === 'number' &&
                typeof item[2] === 'number'
            )) {
                throw new BadRequestException('Subtopics musi być listą trójek [string, number, number]');
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
                typeof r.mode !== 'string' ||
                typeof r.literature !== 'string' ||
                !Array.isArray(r.subtopics) ||
                !Array.isArray(r.errors) ||
                !Array.isArray(r.outputSubtopics) ||
                typeof r.attempt !== 'number' ||
                typeof r.text !== 'string' ||
                typeof r.note !== 'string'
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
        const wordsThreshold = 3;

        const url = `${this.fastapiUrl}/admin/interactive-task-generate`;

        try {
            const subject = await this.prismaService.subject.findUnique({ where: { id: subjectId } });
            if (!subject) throw new BadRequestException('Przedmiot nie został znaleziony');

            const section = await this.prismaService.section.findUnique({ where: { id: sectionId } });
            if (!section) throw new BadRequestException('Dział nie został znaleziony');

            const topic = await this.prismaService.topic.findUnique({ where: { id: topicId } });
            if (!topic) throw new BadRequestException('Temat nie został znaleziony');

            const userSubject = await this.prismaService.userSubject.findUnique({
                where: {
                    userId_subjectId: {
                        userId: userId,
                        subjectId: subjectId
                    }
                },
                select: {
                    threshold: true,
                    detailLevel: true
                }
            });

            const threshold = userSubject?.threshold ?? 50;

            const topics = await this.prismaService.topic.findMany({
                where: {
                    subjectId,
                    section: { type: { not: 'Stories' } },
                },
                include: {
                    subtopics: {
                        include: {
                            progresses: {
                                where: {
                                    userId,
                                    task: { finished: true, userId }
                                },
                                select: { percent: true, updatedAt: true },
                                orderBy: { updatedAt: 'asc' },
                            },
                        },
                    },
                },
            });

            const words = await this.prismaService.word.findMany({
                where: {
                    userId,
                    topicId
                },
                include: {
                    tasks: {
                        include: {
                            task: {
                                select: {
                                    id: true,
                                    text: true,
                                    topic: {
                                        select: {
                                            id: true,
                                            sectionId: true,
                                            subjectId: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                }
            });

            let filteredWords = words;

            const minTasks = Math.min(...words.map(w => w.tasks.length));
            filteredWords = words.filter(w => w.tasks.length === minTasks);

            const sortedWords = filteredWords.sort((a, b) => {
                if (a.frequency !== b.frequency) return b.frequency - a.frequency;

                const aGroup = a.streakCorrectCount < wordsThreshold ? 0 : a.streakCorrectCount === 0 ? 1 : 2;
                const bGroup = b.streakCorrectCount < wordsThreshold ? 0 : b.streakCorrectCount === 0 ? 1 : 2;

                if (aGroup !== bGroup) return aGroup - bGroup;

                if (aGroup === 0) return b.streakCorrectCount - a.streakCorrectCount;
                if (aGroup === 2) return a.streakCorrectCount - b.streakCorrectCount;

                if (a.totalCorrectCount !== b.totalCorrectCount) return a.totalCorrectCount - b.totalCorrectCount;
                if (a.totalAttemptCount !== b.totalAttemptCount) return a.totalAttemptCount - b.totalAttemptCount;
                return a.text.localeCompare(b.text);
            });

            const wordsForData: string[] = sortedWords.map(word => word.text);

            const alpha = 0.7;

            const topicsWithStatus = topics.map(topic => {
                const subtopicsWithPercentAndStatus = topic.subtopics.map(subtopic => {
                    const progresses = subtopic.progresses;

                    let percent = 0;
                    if (progresses.length > 0) {
                        let emaValue: number | null = null;
                        for (const progress of progresses) {
                            const currentPercent = Math.min(100, Number(progress.percent));
                            if (emaValue === null) {
                                emaValue = currentPercent;
                            } else {
                                emaValue = emaValue * (1 - alpha) + currentPercent * alpha;
                            }
                        }
                        percent = Math.min(100, Math.ceil(emaValue!));
                    }

                    let status: 'started' | 'progress' | 'completed';
                    if (percent === 0) {
                        status = 'started';
                    } else if (percent < threshold) {
                        status = 'progress';
                    } else {
                        status = 'completed';
                    }

                    return { ...subtopic, percent, status };
                });

                const completed = subtopicsWithPercentAndStatus.length > 0 && subtopicsWithPercentAndStatus.every(st => st.status === 'completed');

                return {
                    ...topic,
                    completed,
                    subtopics: subtopicsWithPercentAndStatus,
                };
            });

            const completedTopics = topicsWithStatus.filter(t => t.completed);

            const topicsForData: [string, number][] = completedTopics.map(t => [
                t.name,
                Math.max(...t.subtopics.map(st => st.percent))
            ]);

            data.subject = data.subject ?? subject.name;
            data.section = data.section ?? section.name;
            data.topic = data.topic ?? topic.name;
            data.subtopics = data.subtopics ?? topicsForData.sort((a, b) => b[1] - a[1]);
            data.difficulty = data.difficulty ?? section.difficulty;
            data.words = data.words ?? wordsForData;

            const resolvedQuestionPrompt =
                (topic.questionPrompt?.trim() || section.questionPrompt?.trim() || subject.questionPrompt) ?? null;

            data.prompt = resolvedQuestionPrompt;

            if (!Array.isArray(data.subtopics) || !data.subtopics.every(item =>
                Array.isArray(item) &&
                item.length === 2 &&
                typeof item[0] === 'string' &&
                typeof item[1] === 'number'
            )) {
                throw new BadRequestException('Subtopics musi być listą par [string, number]');
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
                typeof r.difficulty !== 'string' ||
                typeof r.topic !== 'string' ||
                !Array.isArray(r.subtopics) ||
                !Array.isArray(r.words) ||
                !Array.isArray(r.outputWords) ||
                !Array.isArray(r.errors) ||
                typeof r.attempt !== 'number' ||
                typeof r.text !== 'string' ||
                typeof r.translate !== 'string'
            ) {
                throw new BadRequestException('Niepoprawna struktura odpowiedzi z serwera.');
            }

            if (!r.subtopics.every((item: any) =>
                Array.isArray(item) &&
                item.length === 2 &&
                typeof item[0] === 'string' &&
                typeof item[1] === 'number'
            )) {
                throw new BadRequestException('Subtopics musi być listą par [string, number]');
            }

            if (!r.words.every((item: any) => typeof item === 'string')) {
                throw new BadRequestException('Words musi być listą stringów');
            }

            if (!r.outputWords.every((item: any) => typeof item === 'string')) {
                throw new BadRequestException('OutputWords musi być listą stringów');
            }

            if (!r.errors.every((item: any) => typeof item === 'string')) {
                throw new BadRequestException('Errors musi być listą stringów');
            }

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

    async questionsTaskAIGenerate(
        subjectId: number,
        sectionId: number,
        topicId: number,
        data: QuestionsTaskAIGenerate,
        signal?: AbortSignal
    ) {
        const url = `${this.fastapiUrl}/admin/questions-task-generate`;
        
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
            data.section = data.section ?? section.name;
            data.topic = data.topic ?? topic.name;
            
            const resolvedSubQuestionsPrompt =
                topic.subQuestionsPrompt?.trim()
                    ? topic.subQuestionsPrompt
                    : section.subQuestionsPrompt?.trim()
                    ? section.subQuestionsPrompt
                    : subject.subQuestionsPrompt ?? null;
            
            data.prompt = resolvedSubQuestionsPrompt;

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
                !Array.isArray(r.errors) ||
                typeof r.attempt !== 'number' ||
                typeof r.text !== 'string' ||
                !Array.isArray(r.questions)
            ) {
                throw new BadRequestException('Niepoprawna struktura odpowiedzi z serwera.');
            }

            if (!r.errors.every((item: any) => typeof item === 'string')) {
                throw new BadRequestException('Errors musi być listą stringów');
            }

            if (!r.questions.every((item: any) => typeof item === 'string')) {
                throw new BadRequestException('Questions musi być listą stringów');
            }

            return {
                statusCode: 201,
                message: "Generacja tekstu pytań etapowych udane",
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

    async solutionAIGenerate(
        subjectId: number,
        sectionId: number,
        topicId: number,
        data: SolutionAIGenerate,
        signal?: AbortSignal
    ) {
        const url = `${this.fastapiUrl}/admin/solution-generate`;
        
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

            const resolvedSolutionPrompt =
                topic.solutionPrompt?.trim()
                    ? topic.solutionPrompt
                    : section.solutionPrompt?.trim()
                    ? section.solutionPrompt
                    : subject.solutionPrompt ?? null;
            
            data.prompt = resolvedSolutionPrompt;

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
                typeof r.text !== 'string' ||
                typeof r.solution !== 'string'
            ) {
                throw new BadRequestException('Niepoprawna struktura odpowiedzi z serwera.');
            }

            if (!r.errors.every((item: any) => typeof item === 'string')) {
                throw new BadRequestException('Errors musi być listą stringów');
            }

            return {
                statusCode: 201,
                message: "Generacja rozwiązania zadania udane",
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

            const resolvedAnswersPrompt =
                topic.answersPrompt?.trim()
                    ? topic.answersPrompt
                    : section.answersPrompt?.trim()
                    ? section.answersPrompt
                    : subject.answersPrompt ?? null;
            
            data.prompt = resolvedAnswersPrompt;

            if (!Array.isArray(data.errors) || !data.errors.every(item => typeof item === 'string')) {
                throw new BadRequestException('Errors musi być listą stringów');
            }

            if (!Array.isArray(data.options) || !data.options.every(item => typeof item === 'string')) {
                throw new BadRequestException('Options musi być listą stringów');
            }

            if (!Array.isArray(data.explanations) || !data.explanations.every(item => typeof item === 'string')) {
                throw new BadRequestException('Explanations musi być listą stringów');
            }

            const response$ = this.httpService.post(url, data, { signal });
            const response = await firstValueFrom(response$);
            const r = response.data;

            if (
                typeof r.prompt !== 'string' ||
                typeof r.changed !== 'string' ||
                !Array.isArray(r.errors) ||
                !Array.isArray(r.options) ||
                !Array.isArray(r.explanations) ||
                typeof r.attempt !== 'number' ||
                typeof r.text !== 'string' ||
                typeof r.solution !== 'string' ||
                typeof r.random1 !== 'number' ||
                typeof r.random2 !== 'number'
            ) {
                throw new BadRequestException('Niepoprawna struktura odpowiedzi z serwera.');
            }

            if (!r.errors.every((item: any) => typeof item === 'string')) {
                throw new BadRequestException('Errors w odpowiedzi musi być listą stringów');
            }

            if (!r.options.every((item: any) => typeof item === 'string')) {
                throw new BadRequestException('Options w odpowiedzi musi być listą stringów');
            }

            if (!r.explanations.every((item: any) => typeof item === 'string')) {
                throw new BadRequestException('Explanations w odpowiedzi musi być listą stringów');
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
            data.section = data.section ?? section.name;
            data.topic = data.topic ?? topic.name;

            const resolvedClosedSubtopicsPrompt =
                topic.closedSubtopicsPrompt?.trim()
                    ? topic.closedSubtopicsPrompt
                    : section.closedSubtopicsPrompt?.trim()
                    ? section.closedSubtopicsPrompt
                    : subject.closedSubtopicsPrompt ?? null;
            
            data.prompt = resolvedClosedSubtopicsPrompt;

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
                typeof r.text !== 'string' ||
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

    async createTaskTransaction(
        userId: number,
        subjectId: number,
        sectionId: number,
        topicId: number,
        taskData: TaskCreateRequest
    ) {
        try {
            const subject = await this.prismaService.subject.findUnique({ where: { id: subjectId } });
            if (!subject) throw new BadRequestException('Przedmiot nie został znaleziony');

            const section = await this.prismaService.section.findUnique({ where: { id: sectionId } });
            if (!section) throw new BadRequestException('Dział nie został znaleziony');

            const topic = await this.prismaService.topic.findUnique({ where: { id: topicId } });
            if (!topic) throw new BadRequestException('Temat nie został znaleziony');

            return await this.prismaService.$transaction(async (prismaClient) => {
                let taskId: number;

                if (taskData.id) {
                    const existingTask = await prismaClient.task.findUnique({
                        where: {
                            userId,
                            id: taskData.id
                        }
                    });

                    if (!existingTask) {
                        throw new BadRequestException('Zadanie nie zostało znalezione');
                    }

                    const updateData: any = {};

                    if (taskData.text !== undefined) updateData.text = taskData.text;
                    if (taskData.note !== undefined) updateData.note = taskData.note;
                    if (taskData.solution !== undefined) updateData.solution = taskData.solution;
                    if (taskData.options !== undefined) updateData.options = taskData.options;
                    if (taskData.explanations !== undefined) updateData.explanations = taskData.explanations;
                    if (taskData.stage !== undefined) updateData.stage = taskData.stage;

                    await prismaClient.task.update({
                        where: {
                            userId,
                            id: taskData.id
                        },
                        data: updateData
                    });

                    taskId = taskData.id;

                    if (taskData.taskSubtopics) {
                        await prismaClient.subtopicProgress.deleteMany(
                            {
                                where: {
                                    taskId,
                                    userId
                                }
                            }
                        );

                        for (const subtopicName of taskData.taskSubtopics) {
                            const { subtopic } = await this.subtopicService.findSubtopicByName(
                                subjectId,
                                sectionId,
                                topicId,
                                subtopicName,
                                prismaClient
                            );

                            await prismaClient.subtopicProgress.create({
                                data: {
                                    percent: 0,
                                    subtopicId: subtopic.id,
                                    taskId,
                                    userId
                                }
                            });
                        }
                    }

                    return {
                        statusCode: 200,
                        message: 'Zadanie zostało zaktualizowane'
                    };

                } else {
                    const lastTask = await prismaClient.task.findFirst({
                        where: {
                            userId,
                            topicId
                        },
                        orderBy: { order: 'desc' },
                        select: { order: true }
                    });

                    const order = (lastTask?.order ?? 0) + 1;

                    const newTask = await prismaClient.task.create({
                        data: {
                            text: taskData.text,
                            note: taskData.note,
                            solution: taskData.solution,
                            options: taskData.options,
                            explanations: taskData.explanations,
                            stage: taskData.stage ?? 0,
                            topicId,
                            userId,
                            order
                        }
                    });

                    taskId = newTask.id;

                    if (taskData.taskSubtopics && taskData.taskSubtopics.length > 0) {
                        for (const subtopicName of taskData.taskSubtopics) {
                            const { subtopic } = await this.subtopicService.findSubtopicByName(
                                subjectId,
                                sectionId,
                                topicId,
                                subtopicName,
                                prismaClient
                            );

                            await prismaClient.subtopicProgress.create({
                                data: {
                                    percent: 0,
                                    subtopicId: subtopic.id,
                                    taskId,
                                    userId
                                }
                            });
                        }
                    }

                    if (taskData.words && taskData.words.length > 0) {
                        const normalizedTaskWords = Array.from(
                            new Set(taskData.words.map(w => w.toLowerCase().trim()))
                        );

                        const dbWords = await prismaClient.word.findMany({
                            where: {
                                topicId,
                                userId,
                            },
                            select: {
                                id: true,
                                text: true,
                            },
                        });

                        const wordMap = new Map<string, number>();
                        for (const w of dbWords) {
                            wordMap.set(w.text.toLowerCase(), w.id);
                        }

                        const wordIds: number[] = [];
                        for (const word of normalizedTaskWords) {
                            const wordId = wordMap.get(word);
                            if (wordId)
                                wordIds.push(wordId);
                        }

                        await prismaClient.taskWord.deleteMany({
                            where: { taskId },
                        });

                        if (wordIds.length > 0) {
                            await prismaClient.taskWord.createMany({
                                data: wordIds.map(wordId => ({
                                    taskId,
                                    wordId,
                                })),
                                skipDuplicates: true,
                            });
                        }
                    }

                    return {
                        statusCode: 200,
                        message: 'Zadanie zostało dodane'
                    };
                }
            }, {
                timeout: 900000
            });
        }
        catch (error) {
            throw new InternalServerErrorException(`Nie udało się zapisać zadanie: ${error}`);
        }
    }

    async createSubTasksTransaction(
        userId: number,
        subjectId: number,
        sectionId: number,
        topicId: number,
        parentTaskId: number,
        tasksData: TaskCreateRequest[]
    ) {
        try {
            const subject = await this.prismaService.subject.findUnique({ where: { id: subjectId } });
            if (!subject) throw new BadRequestException('Przedmiot nie został znaleziony');

            const section = await this.prismaService.section.findUnique({ where: { id: sectionId } });
            if (!section) throw new BadRequestException('Dział nie został znaleziony');

            const topic = await this.prismaService.topic.findUnique({ where: { id: topicId } });
            if (!topic) throw new BadRequestException('Temat nie został znaleziony');

            const parentTask = await this.prismaService.task.findUnique({ where: { id: parentTaskId, userId } });
            if (!parentTask) throw new BadRequestException('Zadanie nie zostało znalezione');

            return await this.prismaService.$transaction(async (prismaClient) => {
                const saveTask = async (taskData: TaskCreateRequest) => {
                    let taskId: number;

                    if (taskData.id) {
                        const existingTask = await prismaClient.task.findUnique({ where: { id: taskData.id, userId } });
                        if (!existingTask) throw new BadRequestException('Zadanie nie zostało znalezione');

                        const updateData: any = {
                            parentTaskId
                        };
                        if (taskData.text !== undefined) updateData.text = taskData.text;
                        if (taskData.solution !== undefined) updateData.solution = taskData.solution;
                        if (taskData.options !== undefined) updateData.options = taskData.options;
                        if (taskData.explanations !== undefined) updateData.explanations = taskData.explanations;
                        if (taskData.stage !== undefined) updateData.stage = taskData.stage;

                        await prismaClient.task.update({
                            where: { id: taskData.id, userId },
                            data: updateData
                        });

                        taskId = taskData.id;
                    } else {
                        const lastTask = await prismaClient.task.findFirst({
                            where: { topicId, userId },
                            orderBy: { order: 'desc' },
                            select: { order: true }
                        });

                        const order = (lastTask?.order ?? 0) + 1;

                        const newTask = await prismaClient.task.create({
                            data: {
                                text: taskData.text,
                                solution: taskData.solution,
                                options: taskData.options,
                                explanations:  taskData.explanations,
                                stage: taskData.stage ?? 0,
                                topicId,
                                order,
                                parentTaskId,
                                userId
                            }
                        });

                        taskId = newTask.id;
                    }

                    if (taskData.taskSubtopics) {
                        await prismaClient.subtopicProgress.deleteMany({ where: { taskId, userId } });

                        for (const subtopicName of taskData.taskSubtopics) {
                            const { subtopic } = await this.subtopicService.findSubtopicByName(
                                subjectId,
                                sectionId,
                                topicId,
                                subtopicName,
                                prismaClient
                            );

                            await prismaClient.subtopicProgress.create({
                                data: {
                                    percent: 0,
                                    subtopicId: subtopic.id,
                                    taskId,
                                    userId
                                }
                            });
                        }
                    }

                    return taskId;
                };

                for (const taskData of tasksData) {
                    await saveTask(taskData);
                }

                return {
                    statusCode: 200,
                    message: 'Podzadania zostały zapisane'
                };

            }, {
                timeout: 900000
            });

        } catch (error) {
            throw new InternalServerErrorException(`Nie udało się zapisać zadania: ${error}`);
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
            const subject = await this.prismaService.subject.findUnique({ where: { id: subjectId } });
            if (!subject) throw new BadRequestException('Przedmiot nie został znaleziony');

            const section = await this.prismaService.section.findUnique({ where: { id: sectionId } });
            if (!section) throw new BadRequestException('Dział nie został znaleziony');

            const topic = await this.prismaService.topic.findUnique({ where: { id: topicId } });
            if (!topic) throw new BadRequestException('Temat nie został znaleziony');

            const task = await this.prismaService.task.findUnique({ where: { id: taskId, userId } });
            if (!task) throw new BadRequestException('Zadanie nie zostało znalezione');

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

    async subtopicsProgressTaskTransaction(
        userId: number,
        subjectId: number,
        sectionId: number,
        topicId: number,
        taskId: number,
        data: SubtopicsProgressUpdateRequest
    ) {
        try {
            const subject = await this.prismaService.subject.findUnique({ where: { id: subjectId } });
            if (!subject) throw new BadRequestException('Przedmiot nie został znaleziony');

            const section = await this.prismaService.section.findUnique({ where: { id: sectionId } });
            if (!section) throw new BadRequestException('Dział nie został znaleziony');

            const topic = await this.prismaService.topic.findUnique({ where: { id: topicId } });
            if (!topic) throw new BadRequestException('Temat nie został znaleziony');

            return await this.prismaService.$transaction(async (prismaClient) => {
                for (const sub of data.subtopics) {
                    const { subtopic } = await this.subtopicService.findSubtopicByName(
                        subjectId,
                        sectionId,
                        topicId,
                        sub.name,
                        prismaClient
                    );

                    const subtopicProgress = await prismaClient.subtopicProgress.findFirst({
                        where: {
                            taskId,
                            userId,
                            subtopicId: subtopic.id
                        }
                    });

                    if (!subtopicProgress) {
                        throw new BadRequestException('SubtopicProgress nie został znaleziony');
                    }

                    await prismaClient.subtopicProgress.update({
                        where: { id: subtopicProgress.id, userId },
                        data: { percent: sub.percent }
                    });
                }

                const averagePercent = await prismaClient.subtopicProgress.aggregate({
                    where: { taskId, userId },
                    _avg: {
                        percent: true,
                    },
                });

                await prismaClient.task.update({
                    where: { id: taskId, userId },
                    data: {
                        explanation: data.explanation,
                        finished: true,
                        percent: averagePercent._avg.percent || 0
                    }
                });

                return {
                    statusCode: 200,
                    message: 'Podtematy zadania zostały policzone',
                };
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
                message: 'Zadanie zpstało zaktualizowane pomyślnie',
                task: updatedTask
            }
        }
        catch (error) {
            throw new InternalServerErrorException('Nie udało się zaktualizować zadania');
        }
    }

    async updatePercents(
        userId: number,
        subjectId: number,
        sectionId: number,
        topicId: number,
        id: number,
        userOptions: number[]
    ) {
        try {
            const existingSubject = await this.prismaService.subject.findUnique({ where: { id: subjectId } });
            if (!existingSubject) {
                return { statusCode: 404, message: `Przedmiot nie został znaleziony` };
            }

            const existingSection = await this.prismaService.section.findUnique({ where: { id: sectionId } });
            if (!existingSection) {
                return { statusCode: 404, message: `Dział nie został znaleziony` };
            }

            const existingTopic = await this.prismaService.topic.findUnique({ where: { id: topicId } });
            if (!existingTopic) {
                return { statusCode: 404, message: `Temat nie został znaleziony` };
            }

            return await this.prismaService.$transaction(async (prismaClient) => {
                const task = await prismaClient.task.findFirst({
                    where: { id, userId },
                    include: {
                        subTasks: { orderBy: { order: 'asc' } },
                    },
                    orderBy: { order: 'asc' },
                });

                if (!task) {
                    return { statusCode: 404, message: `Zadanie nie zostało znalezione` };
                }

                if (userOptions.length !== task.subTasks.length) {
                    return { statusCode: 400, message: `Liczba wariantów się nie zgadza` };
                }

                await prismaClient.task.update({
                    where: { id: task.id, userId },
                    data: { answered: true, finished: true },
                });

                let percentsTasksTotal = 0;
                for (let i = 0; i < task.subTasks.length; i++) {
                    const subTask = task.subTasks[i];
                    const userOption = userOptions[i];

                    await prismaClient.task.update({
                        where: { id: subTask.id, userId },
                        data: {
                            userOptionIndex: userOption,
                            answered: true,
                            finished: true,
                        },
                    });

                    if (subTask.correctOptionIndex === userOption) {
                        percentsTasksTotal += 100;
                    }
                }

                percentsTasksTotal /= task.subTasks.length;

                const words = await this.prismaService.word.findMany({
                    where: {
                        topicId,
                        userId
                    }
                });

                const formattedWords = words.map(word => {
                    let percent = 0;
                    if (word.totalAttemptCount > 0) {
                        percent = Math.min(100, Math.ceil(word.totalCorrectCount / word.totalAttemptCount * 100));
                    }
                    
                    return {
                        ...word,
                        percent: percent,
                    };
                });

                let totalPercent = 0;
                let wordsWithAttempts = 0;

                formattedWords.forEach(word => {
                    totalPercent += word.percent;
                    wordsWithAttempts++;
                });

                const averagePercentByWords = wordsWithAttempts > 0 
                    ? Math.ceil(totalPercent / wordsWithAttempts)
                    : 0;

                await prismaClient.task.update({
                    where: { id: task.id, userId },
                    data: {
                        percent: Math.ceil((percentsTasksTotal + averagePercentByWords) / 2),
                        percentAudio: percentsTasksTotal,
                        percentWords: averagePercentByWords,
                    },
                });

                return {
                    statusCode: 200,
                    message: 'Procenty zostały pomyślnie zaktualizowane',
                };
            }, { timeout: 900000 });
        } catch (error) {
            console.error(`Nie udało się zaktualizować procentów:`, error);
            throw new InternalServerErrorException('Błąd podczas aktualizacji procentów');
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

            const task = await this.prismaService.task.findUnique({
                where: { userId, id },
                include: {
                    audioFiles: true
                }
            });

            if (!task) {
                throw new BadRequestException('Zadanie nie zostało znalezione');
            }

            if (task.audioFiles && task.audioFiles.length > 0) {
                for (const audioFile of task.audioFiles) {
                    if (audioFile.url) {
                        try {
                            const audioKey = this.extractKeyFromUrl(audioFile.url);
                            if (audioKey) {
                                await this.storageService.deleteFile(audioKey);
                            }
                        } catch (deleteError) {
                            console.error(`Nie udało się usunąć pliku audio z S3 (ID: ${audioFile.id}):`, deleteError);
                        }
                    }
                }
            }

            await this.prismaService.task.delete({
                where: { userId, id }
            });

            await this.calculateSubtopicsPercent(userId, subjectId, sectionId, topicId);

            return {
                statusCode: 200,
                message: 'Usuwanie zadania zostało udane'
            };
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
            const [subject, section, topic, task] = await Promise.all([
                this.prismaService.subject.findUnique({ where: { id: subjectId } }),
                this.prismaService.section.findUnique({ where: { id: sectionId } }),
                this.prismaService.topic.findUnique({ where: { id: topicId } }),
                this.prismaService.task.findUnique({ where: { id: taskId } }),
            ]);

            if (!subject) throw new BadRequestException('Przedmiot nie został znaleziony');
            if (!section) throw new BadRequestException('Dział nie został znaleziony');
            if (!topic) throw new BadRequestException('Temat nie został znaleziony');
            if (!task) throw new BadRequestException('Zadanie nie zostało znalezione');

            text = text.toLowerCase();

            let word = await this.prismaService.word.findUnique({
                where: {
                    word_user_subject_unique: {
                        userId,
                        subjectId,
                        text,
                    },
                },
            });

            if (!word) {
                word = await this.prismaService.word.create({
                    data: {
                        text,
                        finished: false,
                        streakCorrectCount: 0,
                        topicId,
                        userId,
                        subjectId
                    },
                });
            } else {
                word = await this.prismaService.word.update({
                    where: { id: word.id },
                    data: {
                        finished: false,
                        streakCorrectCount: 0,
                    },
                });
            }

            await this.prismaService.taskWord.create({
                data: {
                    taskId,
                    wordId: word.id,
                },
            });

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