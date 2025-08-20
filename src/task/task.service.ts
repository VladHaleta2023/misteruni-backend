import { HttpService } from '@nestjs/axios';
import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { FASTAPI_URL } from 'src/constans';
import { OptionsAIGenerate, ProblemsAIGenerate, SolutionAIGenerate, TaskAIGenerate } from './dto/task-generate.dto';
import { firstValueFrom } from 'rxjs';
import { SubtopicService } from 'src/subtopic/subtopic.service';
import { TaskCreateRequest } from './dto/task-request.dto';

@Injectable()
export class TaskService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly subtopicService: SubtopicService,
        private readonly httpService: HttpService,
        @Inject(FASTAPI_URL) private readonly fastAPIUrl: string,
    ) {}

    async findAllTasks(
        subjectId: number,
        sectionId: number,
        topicId: number
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

            const tasks = await this.prismaService.task.findMany({
                where: {
                    topicId
                },
                orderBy: {
                    order: 'asc'
                }
            });

            return {
                statusCode: 200,
                message: 'Pobrano listę zadań pomyślnie',
                tasks
            }
        }
        catch (error) {
            throw new InternalServerErrorException('Nie udało się pobrać zadania');
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

            return {
                statusCode: 200,
                message: 'Pobrano zadanie pomyślnie',
                task
            }
        }
        catch (error) {
            throw new InternalServerErrorException('Nie udało się pobrać zadania');
        }
    }

    async findPendingTask(
        subjectId: number,
        sectionId: number,
        topicId: number
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
                    topicId, finished: false
                },
                include: {
                    progresses: {
                        include: { subtopic: true }
                    },
                    subTasks: {
                        include: {
                            progresses: {
                                include: { subtopic: true }
                            }
                        }
                    }
                },
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

            const { progresses, subTasks, ...taskData } = task;
            const taskWithSubtopics = {
                ...taskData,
                subtopics: taskSubtopics,
                subTasks: subTasksWithSubtopics
            };

            return {
                statusCode: 200,
                message: 'Pobrano ostatnie zadanie pomyślnie',
                task: taskWithSubtopics,
            };
        }
        catch (error) {
            throw new InternalServerErrorException('Nie udało się pobrać ostatniego zadania');
        }
    }

    async taskAIGenerate(
        subjectId: number,
        sectionId: number,
        topicId: number,
        data: TaskAIGenerate
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

            const response$ = this.httpService.post(url, data);
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

    async solutionAIGenerate(
        subjectId: number,
        sectionId: number,
        topicId: number,
        data: SolutionAIGenerate
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

            const response$ = this.httpService.post(url, data);
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
        data: OptionsAIGenerate
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

            const response$ = this.httpService.post(url, data);
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
        data: ProblemsAIGenerate
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

            const subtopics = await this.prismaService.subtopic.findMany({
                where: { topicId },
                select: { name: true }
            });

            data.subject = data.subject ?? subject.name;
            data.section = data.section ?? section.name;
            data.topic = data.topic ?? topic.name;
            data.subtopics = data.subtopics ?? subtopics.map(s => s.name);
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

            const response$ = this.httpService.post(url, data);
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

            return await this.prismaService.$transaction(async (prismaClient) => {
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
                        topicId,
                        order
                    }
                });

                const taskId = newTask.id;

                for (let i = 0; i < taskData.taskSubtopics.length; i++) {
                    const { subtopic } = await this.subtopicService.findSubtopicByName(
                        subjectId,
                        sectionId,
                        topicId,
                        taskData.taskSubtopics[i],
                        prismaClient
                    );

                    const subtopicId = subtopic.id;

                    await prismaClient.subtopicProgress.create({
                        data: {
                            percent: 100,
                            subtopicId: subtopicId,
                            taskId: taskId,
                        }
                    });
                }

                return {
                    statusCode: 201,
                    message: 'Zadanie zostało dodane',
                }
            }, {
                timeout: 900000,
            });
        }
        catch (error) {
            throw new InternalServerErrorException(`Nie udało się zapisać zadanie: ${error}`);
        }
    }
}