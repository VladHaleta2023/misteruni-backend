import { HttpService } from '@nestjs/axios';
import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { FASTAPI_URL } from 'src/constans';
import { InteractiveTaskAIGenerate, OptionsAIGenerate, ProblemsAIGenerate, QuestionsTaskAIGenerate, SolutionAIGenerate, TaskAIGenerate } from './dto/task-generate.dto';
import { firstValueFrom } from 'rxjs';
import { SubtopicService } from 'src/subtopic/subtopic.service';
import { SubtopicsProgressUpdateRequest, TaskCreateRequest, TaskUserSolutionRequest } from './dto/task-request.dto';
import { OptionsService } from 'src/options/options.service';

type Status = 'blocked' | 'started' | 'progress' | 'completed';

@Injectable()
export class TaskService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly subtopicService: SubtopicService,
        private readonly httpService: HttpService,
        private readonly optionsService: OptionsService,
        @Inject(FASTAPI_URL) private readonly fastAPIUrl: string,
    ) {}

    async findTasks(
        subjectId: number,
        sectionId: number,
        topicId: number
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

            const tasks = await this.prismaService.task.findMany({
                where: { topicId, parentTaskId: null },
                orderBy: [
                    { updatedAt: 'desc' },
                    { order: 'asc' }
                ],
            });

            const tasksWithPercent = await Promise.all(
                tasks.map(async task => {
                    let status: Status = "started";

                    if (task.percent === 0) {
                        status = 'started';
                    } else if (task.percent < subject.threshold) {
                        status = 'progress';
                    } else {
                        status = 'completed';
                    }

                    return {
                        ...task,
                        status,
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
                const updated = task.updatedAt;
                const day = String(updated.getDate()).padStart(2, '0');
                const month = String(updated.getMonth() + 1).padStart(2, '0');
                const year = updated.getFullYear();
                const dateKey = `${day}-${month}-${year}`;

                if (!groupedTasksMap[dateKey]) groupedTasksMap[dateKey] = [];
                groupedTasksMap[dateKey].push(task);
            });

            const groupedTasks = Object.entries(groupedTasksMap).map(([dateKey, tasks]) => {
                const [day, month, year] = dateKey.split('-');
                return {
                    date: {
                        day,
                        month,
                        year
                    },
                    tasks,
                };
            });

            return {
                statusCode: 200,
                message: 'Pobrano listę zadań pomyślnie',
                elements: groupedTasks,
            };
        } catch (error) {
            throw new InternalServerErrorException('Nie udało się pobrać listę zadań');
        }
    }

    async findTaskById(
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
                where: { id },
                include: {
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

            const { progresses, subTasks, audioFiles, ...taskData } = task;

            const taskWithSubtopics = {
                ...taskData,
                subtopics: taskSubtopics,
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
        subjectId: number,
        sectionId: number,
        topicId: number,
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

            const task = await this.prismaService.task.findFirst({
                where: {
                    topicId,
                    finished: false,
                    parentTask: null,
                },
                include: {
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

            const { progresses, subTasks, audioFiles, ...taskData } = task;
            const taskWithSubtopicsAndUrls = {
                ...taskData,
                subtopics: taskSubtopics,
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
            throw new InternalServerErrorException('Nie udało się pobrać ostatniego zadania');
        }
    }

    async taskAIGenerate(
        subjectId: number,
        sectionId: number,
        topicId: number,
        data: TaskAIGenerate,
        signal?: AbortSignal
    ) {
        const url = `${this.fastAPIUrl}/admin/task-generate`;
        
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

            const subtopics = await this.prismaService.subtopic.findMany({
                where: { topicId },
                select: { name: true, percent: true }
            });

            const tasks = await this.prismaService.task.findMany({
                where: { topicId, parentTaskId: null },
                select: { text: true }
            });

            const taskTexts = tasks.map(task => task.text);

            data.subject = data.subject ?? subject.name;
            data.section = data.section ?? section.name;
            data.topic = data.topic ?? topic.name;
            data.subtopics = data.subtopics ?? subtopics.map(s => [s.name, s.percent]);
            data.tasks = data.tasks ?? taskTexts;
            data.difficulty = data.difficulty ?? subject.difficulty;
            data.threshold = data.threshold ?? subject.threshold;

            const resolvedQuestionPrompt =
                topic.questionPrompt?.trim()
                    ? topic.questionPrompt
                    : section.questionPrompt?.trim()
                    ? section.questionPrompt
                    : subject.questionPrompt ?? null;
            
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
                typeof r.topic !== 'string' ||
                !Array.isArray(r.subtopics) ||
                !Array.isArray(r.errors) ||
                !Array.isArray(r.outputSubtopics) ||
                typeof r.attempt !== 'number' ||
                typeof r.text !== 'string'
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

            if (!r.errors.every((item: any) => typeof item === 'string')) {
                throw new BadRequestException('Errors musi być listą stringów');
            }

            if (!r.outputSubtopics.every((item: any) => typeof item === 'string')) {
                throw new BadRequestException('OutputSubtopics musi być listą stringów');
            }

            return {
                statusCode: 201,
                message: "Generacja tekstu zadania udane",
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

    async interactiveTaskAIGenerate(
        subjectId: number,
        sectionId: number,
        topicId: number,
        data: InteractiveTaskAIGenerate,
        signal?: AbortSignal
    ) {
        const url = `${this.fastAPIUrl}/admin/interactive-task-generate`;
        
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

            const type: string = "Grammar";

            const topics = await this.prismaService.topic.findMany({
                where: {
                    subjectId,
                    section: { type }
                },
                include: {
                    subtopics: { select: { percent: true } }
                }
            });

            const topicsWithAverage = topics.map(topic => {
                const avgPercent = topic.subtopics.length > 0
                    ? topic.subtopics.reduce((sum, s) => sum + s.percent, 0) / topic.subtopics.length
                    : 0;

                return {
                    name: topic.name,
                    percent: Math.round(avgPercent)
                };
            });

            data.subject = data.subject ?? subject.name;
            data.section = data.section ?? section.name;
            data.topic = data.topic ?? topic.name;
            data.subtopics = data.subtopics ?? topicsWithAverage
                .sort((a, b) => b.percent - a.percent)
                .map(s => [s.name, s.percent]);
            data.difficulty = data.difficulty ?? subject.difficulty;
            
            const resolvedQuestionPrompt =
                topic.questionPrompt?.trim()
                    ? topic.questionPrompt
                    : section.questionPrompt?.trim()
                    ? section.questionPrompt
                    : subject.questionPrompt ?? null;
            
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
                typeof r.topic !== 'string' ||
                !Array.isArray(r.subtopics) ||
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

            if (!r.errors.every((item: any) => typeof item === 'string')) {
                throw new BadRequestException('Errors musi być listą stringów');
            }

            return {
                statusCode: 201,
                message: "Generacja tekstu zadania udane",
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

    async questionsTaskAIGenerate(
        subjectId: number,
        sectionId: number,
        topicId: number,
        data: QuestionsTaskAIGenerate,
        signal?: AbortSignal
    ) {
        const url = `${this.fastAPIUrl}/admin/questions-task-generate`;
        
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

            const type: string = "Grammar";

            data.subject = data.subject ?? subject.name;
            data.section = data.section ?? section.name;
            data.topic = data.topic ?? topic.name;
            data.difficulty = data.difficulty ?? subject.difficulty;
            
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
        const url = `${this.fastAPIUrl}/admin/solution-generate`;
        
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
        const url = `${this.fastAPIUrl}/admin/options-generate`;
        
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

            const response$ = this.httpService.post(url, data, { signal });
            const response = await firstValueFrom(response$);
            const r = response.data;

            if (
                typeof r.prompt !== 'string' ||
                typeof r.changed !== 'string' ||
                !Array.isArray(r.errors) ||
                !Array.isArray(r.options) ||
                typeof r.attempt !== 'number' ||
                typeof r.correctOptionIndex !== 'number' ||
                typeof r.text !== 'string' ||
                typeof r.solution !== 'string'
            ) {
                throw new BadRequestException('Niepoprawna struktura odpowiedzi z serwera.');
            }

            if (!r.errors.every((item: any) => typeof item === 'string')) {
                throw new BadRequestException('Errors musi być listą stringów');
            }


            if (!Array.isArray(data.options) || !data.options.every(item => typeof item === 'string')) {
                throw new BadRequestException('Options musi być listą stringów');
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
        const url = `${this.fastAPIUrl}/admin/problems-generate`;
        
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
            data.difficulty =  data.difficulty ?? subject.difficulty;

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
                typeof r.correctOptionIndex !== 'number' ||
                typeof r.text !== 'string' ||
                typeof r.difficulty !== 'number' ||
                typeof r.subject !== 'string' ||
                typeof r.section !== 'string' ||
                typeof r.topic !== 'string' ||
                typeof r.solution !== 'string'
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
                        where: { id: taskData.id }
                    });

                    if (!existingTask) {
                        throw new BadRequestException('Zadanie nie zostało znalezione');
                    }

                    const updateData: any = {};

                    if (taskData.text !== undefined) updateData.text = taskData.text;
                    if (taskData.solution !== undefined) updateData.solution = taskData.solution;
                    if (taskData.options !== undefined) updateData.options = taskData.options;
                    if (taskData.correctOptionIndex !== undefined) updateData.correctOptionIndex = taskData.correctOptionIndex;
                    if (taskData.stage !== undefined) updateData.stage = taskData.stage;

                    await prismaClient.task.update({
                        where: { id: taskData.id },
                        data: updateData
                    });

                    taskId = taskData.id;

                    if (taskData.taskSubtopics) {
                        await prismaClient.subtopicProgress.deleteMany({ where: { taskId } });

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
                                    percent: 100,
                                    subtopicId: subtopic.id,
                                    taskId
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
                        where: { topicId },
                        orderBy: { order: 'desc' },
                        select: { order: true }
                    });

                    const order = (lastTask?.order ?? 0) + 1;

                    const newTask = await prismaClient.task.create({
                        data: {
                            text: taskData.text,
                            solution: taskData.solution,
                            options: taskData.options,
                            correctOptionIndex: taskData.correctOptionIndex,
                            stage: taskData.stage ?? 0,
                            topicId,
                            order
                        }
                    });

                    taskId = newTask.id;

                    if (taskData.taskSubtopics) {
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
                                    percent: 100,
                                    subtopicId: subtopic.id,
                                    taskId
                                }
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

            const parentTask = await this.prismaService.task.findUnique({ where: { id: parentTaskId } });
            if (!parentTask) throw new BadRequestException('Zadanie nie zostało znalezione');

            return await this.prismaService.$transaction(async (prismaClient) => {
                const saveTask = async (taskData: TaskCreateRequest) => {
                    let taskId: number;

                    if (taskData.id) {
                        const existingTask = await prismaClient.task.findUnique({ where: { id: taskData.id } });
                        if (!existingTask) throw new BadRequestException('Zadanie nie zostało znalezione');

                        const updateData: any = {
                            parentTaskId
                        };
                        if (taskData.text !== undefined) updateData.text = taskData.text;
                        if (taskData.solution !== undefined) updateData.solution = taskData.solution;
                        if (taskData.options !== undefined) updateData.options = taskData.options;
                        if (taskData.correctOptionIndex !== undefined) updateData.correctOptionIndex = taskData.correctOptionIndex;
                        if (taskData.stage !== undefined) updateData.stage = taskData.stage;

                        await prismaClient.task.update({
                            where: { id: taskData.id },
                            data: updateData
                        });

                        taskId = taskData.id;
                    } else {
                        const lastTask = await prismaClient.task.findFirst({
                            where: { topicId },
                            orderBy: { order: 'desc' },
                            select: { order: true }
                        });

                        const order = (lastTask?.order ?? 0) + 1;

                        const newTask = await prismaClient.task.create({
                            data: {
                                text: taskData.text,
                                solution: taskData.solution,
                                options: taskData.options,
                                correctOptionIndex: taskData.correctOptionIndex,
                                stage: taskData.stage ?? 0,
                                topicId,
                                order,
                                parentTaskId
                            }
                        });

                        taskId = newTask.id;
                    }

                    if (taskData.taskSubtopics) {
                        await prismaClient.subtopicProgress.deleteMany({ where: { taskId } });

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
                                    percent: 100,
                                    subtopicId: subtopic.id,
                                    taskId
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

            const task = await this.prismaService.task.findUnique({ where: { id: taskId } });
            if (!task) throw new BadRequestException('Zadanie nie zostało znalezione');

            return await this.prismaService.$transaction(async (prismaClient) => {
                await this.optionsService.deleteAudioFileByTaskId(taskId, prismaClient);

                const result = await this.optionsService.textSplitIntoSentences(
                    text,
                    language
                );

                const sentences = result.sentences;
                let partId = 1;

                for (const sentence of sentences) {
                    await this.optionsService.generateTTS(
                        taskId,
                        sentence,
                        partId,
                        language,
                        prismaClient
                    );

                    partId += 1
                }

                await prismaClient.task.update({
                    where: { id: taskId },
                    data: {
                        text: text,
                        stage: stage
                    }
                });

                return {
                    statusCode: 200,
                    message: 'Audio zostało zapisane'
                };

            }, {
                timeout: 900000
            });

        } catch (error) {
            throw new InternalServerErrorException(`Nie udało się zapisać audio: ${error}`);
        }
    }

    async subtopicsProgressTaskTransaction(
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
                            subtopicId: subtopic.id
                        }
                    });

                    if (!subtopicProgress) {
                        throw new BadRequestException('SubtopicProgress nie został znaleziony');
                    }

                    await prismaClient.subtopicProgress.update({
                        where: { id: subtopicProgress.id },
                        data: { percent: sub.percent }
                    });
                }

                const averagePercent = await prismaClient.subtopicProgress.aggregate({
                    where: { taskId },
                    _avg: {
                        percent: true,
                    },
                });

                await prismaClient.task.update({
                    where: { id: taskId },
                    data: {
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
                where: { id }
            });

            if (!task) {
                throw new BadRequestException('Zadanie nie zostało znalezione');
            }

            const updatedTask = await this.prismaService.task.update({
                where: { id },
                data: {
                    ...userData,
                    answered: true
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
        subjectId: number,
        sectionId: number,
        topicId: number,
        id: number,
        userOptions: number[]
    ) {
        try {
            const existingSubject = await this.prismaService.subject.findUnique({ where: { id: subjectId } });
            if (!existingSubject) {
                return {
                    statusCode: 404,
                    message: `Przedmiot nie został znaleziony`,
                };
            }

            const existingSection = await this.prismaService.section.findUnique({ where: { id: sectionId } });
            if (!existingSection) {
                return {
                    statusCode: 404,
                    message: `Dział nie został znaleziony`,
                };
            }

            const existingTopic = await this.prismaService.topic.findUnique({ where: { id: topicId } });
            if (!existingTopic) {
                return {
                    statusCode: 404,
                    message: `Temat nie został znaleziony`,
                };
            }

            const task = await this.prismaService.task.findFirst({
                where: { id },
                include: {
                    subTasks: {
                        orderBy: { order: 'asc' }
                    },
                },
                orderBy: { order: 'asc' }
            });

            if (!task) {
                return {
                    statusCode: 404,
                    message: `Zadanie nie zostało znalezione`,
                };
            }

            if (userOptions.length != task.subTasks.length) {
                return {
                    statusCode: 404,
                    message: `Liczba wariantów się nie zgadza`,
                };
            }

            return await this.prismaService.$transaction(async (prismaClient) => {
                await prismaClient.task.update({
                    where: { id: task.id },
                    data: {
                        answered: true,
                        finished: true
                    }
                });

                let percentsTotal = 0;
                let index = 0;
                for (const subTask of task.subTasks) {
                    await prismaClient.task.update({
                        where: { id: subTask.id },
                        data: {
                            userOptionIndex: userOptions[index],
                            answered: true,
                            finished: true
                        },
                    });

                    if (subTask.correctOptionIndex === userOptions[index])
                        percentsTotal += 100;
                    index += 1;
                }

                percentsTotal /= task.subTasks.length;

                await prismaClient.task.update({
                    where: { id: task.id },
                    data: {
                        percent: percentsTotal
                    }
                })

                await prismaClient.topic.update({
                    where: { id: topicId },
                    data: {
                        percent: (existingTopic.percent + percentsTotal) / 2
                    }
                });

                return {
                    statusCode: 200,
                    message: 'Procenty zostały pomyślnie zaktualizowane',
                };
            });
        }
        catch (error) {
            console.error(`Nie udało się zaktualizować procentów:`, error);
            throw new InternalServerErrorException('Błąd podczas aktualizacji procentów');
        }
    }
}