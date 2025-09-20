import { Body, Controller, Delete, Get, HttpException, Param, ParseIntPipe, Post, Put, Req } from '@nestjs/common';
import { TaskService } from './task.service';
import { InteractiveTaskAIGenerate, OptionsAIGenerate, ProblemsAIGenerate, QuestionsTaskAIGenerate, SolutionAIGenerate, TaskAIGenerate } from './dto/task-generate.dto';
import { SubtopicsProgressUpdateRequest, TaskCreateRequest, TaskUserSolutionRequest } from './dto/task-request.dto';
import { Request } from 'express';

@Controller('subjects/:subjectId/sections/:sectionId/topics/:topicId/tasks')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Get()
  async findTasks(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Req() req: Request
  ) {
    let aborted = false;

    req.on('close', () => {
      aborted = true;
    });

    if (aborted) {
      throw new HttpException('Client aborted', 499);
    }

    const result = await this.taskService.findTasks(subjectId, sectionId, topicId);

    if (aborted) {
      throw new HttpException('Client aborted', 499);
    }

    return result;
  }

  @Get('pending')
  async findPendingTask(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Req() req: Request
  ) {
    let aborted = false;

    req.on('close', () => {
      aborted = true;
    });

    if (aborted) {
      throw new HttpException('Client aborted', 499);
    }

    const result = await this.taskService.findPendingTask(subjectId, sectionId, topicId);

    if (aborted) {
      throw new HttpException('Client aborted', 499);
    }

    return result;
  }

  @Get(':id')
  async findTaskById(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request
  ) {
    let aborted = false;

    req.on('close', () => {
      aborted = true;
    });

    if (aborted) {
      throw new HttpException('Client aborted', 499);
    }

    const result = await this.taskService.findTaskById(subjectId, sectionId, topicId, id);

    if (aborted) {
      throw new HttpException('Client aborted', 499);
    }

    return result;
  }

  @Put(':id/user-solution')
  async updateTaskUserSolution(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() data: TaskUserSolutionRequest,
    @Req() req: Request
  ) {
    let aborted = false;

    req.on('close', () => {
      aborted = true;
    });

    if (aborted) {
      throw new HttpException('Client aborted', 499);
    }

    const result = await this.taskService.updateTaskUserSolution(subjectId, sectionId, topicId, id, data);

    if (aborted) {
      throw new HttpException('Client aborted', 499);
    }

    return result;
  }

  @Put(':id/percents')
  async updatePercents(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body('userOptions') userOptions: number[],
    @Req() req: Request
  ) {
    let aborted = false;

    req.on('close', () => {
      aborted = true;
    });

    if (aborted) {
      throw new HttpException('Client aborted', 499);
    }

    const result = await this.taskService.updatePercents(
      subjectId,
      sectionId,
      topicId,
      id,
      userOptions,
    );

    if (aborted) {
      throw new HttpException('Client aborted', 499);
    }

    return result;
  }

  @Post('task-generate')
  async taskAIGenerate(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Body() data: TaskAIGenerate,
    @Req() req: Request
  ) {
    const controller = new AbortController();

    req.on('close', () => controller.abort());

    try {
      const result = await this.taskService.taskAIGenerate(subjectId, sectionId, topicId, data, controller.signal);
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new HttpException('Client aborted', 499);
      }
      throw error;
    }
  }

  @Post('interactive-task-generate')
  async interactiveTaskAIGenerate(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Body() data: InteractiveTaskAIGenerate,
    @Req() req: Request
  ) {
    const controller = new AbortController();

    req.on('close', () => controller.abort());

    try {
      const result = await this.taskService.interactiveTaskAIGenerate(subjectId, sectionId, topicId, data, controller.signal);
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new HttpException('Client aborted', 499);
      }
      throw error;
    }
  }

  @Post('questions-task-generate')
  async questionsTaskAIGenerate(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Body() data: QuestionsTaskAIGenerate,
    @Req() req: Request
  ) {
    const controller = new AbortController();

    req.on('close', () => controller.abort());

    try {
      const result = await this.taskService.questionsTaskAIGenerate(subjectId, sectionId, topicId, data, controller.signal);
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new HttpException('Client aborted', 499);
      }
      throw error;
    }
  }

  @Post('solution-generate')
  async solutionAIGenerate(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Body() data: SolutionAIGenerate,
    @Req() req: Request
  ) {
    const controller = new AbortController();

    req.on('close', () => controller.abort());

    try {
      const result = await this.taskService.solutionAIGenerate(subjectId, sectionId, topicId, data, controller.signal);
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new HttpException('Client aborted', 499);
      }
      throw error;
    }
  }

  @Post('options-generate')
  async optionsAIGenerate(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Body() data: OptionsAIGenerate,
    @Req() req: Request
  ) {
    const controller = new AbortController();

    req.on('close', () => controller.abort());

    try {
      const result = await this.taskService.optionsAIGenerate(subjectId, sectionId, topicId, data, controller.signal);
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new HttpException('Client aborted', 499);
      }
      throw error;
    }
  }

  @Post('problems-generate')
  async problemsAIGenerate(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Body() data: ProblemsAIGenerate,
    @Req() req: Request
  ) {
    const controller = new AbortController();

    req.on('close', () => controller.abort());

    try {
      const result = await this.taskService.problemsAIGenerate(subjectId, sectionId, topicId, data, controller.signal);
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new HttpException('Client aborted', 499);
      }
      throw error;
    }
  }

  @Post('task-transaction')
  async upsertTaskTransaction(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Body() taskData: TaskCreateRequest,
    @Req() req: Request
  ) {
    let aborted = false;

    req.on('close', () => {
      aborted = true;
    });

    if (aborted) {
      throw new HttpException('Client aborted', 499);
    }

    const result = await this.taskService.createTaskTransaction(subjectId, sectionId, topicId, taskData);

    if (aborted) {
      throw new HttpException('Client aborted', 499);
    }

    return result;
  }

  @Post(':taskId/questions-task-transaction')
  async upsertQuestionsTaskTransaction(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body('tasks') taskData: TaskCreateRequest[],
    @Req() req: Request
  ) {
    let aborted = false;

    req.on('close', () => {
      aborted = true;
    });

    if (aborted) {
      throw new HttpException('Client aborted', 499);
    }

    const result = await this.taskService.createSubTasksTransaction(subjectId, sectionId, topicId, taskId, taskData);

    if (aborted) {
      throw new HttpException('Client aborted', 499);
    }

    return result;
  }

  @Post(':taskId/subtopicsProgress-transaction')
  async subtopicsProgressTaskTransaction(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() data: SubtopicsProgressUpdateRequest,
    @Req() req: Request
  ) {
    let aborted = false;

    req.on('close', () => {
      aborted = true;
    });

    if (aborted) {
      throw new HttpException('Client aborted', 499);
    }

    const result = await this.taskService.subtopicsProgressTaskTransaction(subjectId, sectionId, topicId, taskId, data);

    if (aborted) {
      throw new HttpException('Client aborted', 499);
    }

    return result;
  }

  @Post(':taskId/audio-transaction')
  async audioTaskTransaction(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body('text') text: string,
    @Body('stage') stage: number,
    @Body('language') language: string,
    @Req() req: Request
  ) {
    let aborted = false;

    req.on('close', () => {
      aborted = true;
    });

    if (aborted) {
      throw new HttpException('Client aborted', 499);
    }

    const result = await this.taskService.audioTaskTransaction(subjectId, sectionId, topicId, taskId, text, stage, language);

    if (aborted) {
      throw new HttpException('Client aborted', 499);
    }

    return result;
  }

  @Delete(':id')
  async deleteTask(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request
  ) {
    const controller = new AbortController();

    req.on('close', () => controller.abort());

    try {
      const result = await this.taskService.deleteTask(subjectId, sectionId, topicId, id);
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new HttpException('Client aborted', 499);
      }
      throw error;
    }
  }

  @Get(':id/words')
  async findWords(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request
  ) {
    const controller = new AbortController();

    req.on('close', () => controller.abort());

    try {
      const result = await this.taskService.findWords(subjectId, sectionId, topicId, id);
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new HttpException('Client aborted', 499);
      }
      throw error;
    }
  }

  @Post(':id/words')
  async createWord(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body('text') text: string,
    @Req() req: Request
  ) {
    const controller = new AbortController();

    req.on('close', () => controller.abort());

    try {
      const result = await this.taskService.createWord(subjectId, sectionId, topicId, id, text);
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new HttpException('Client aborted', 499);
      }
      throw error;
    }
  }

  @Delete(':id/words/:wordId')
  async deleteWord(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('wordId', ParseIntPipe) wordId: number,
    @Req() req: Request
  ) {
    const controller = new AbortController();

    req.on('close', () => controller.abort());

    try {
      const result = await this.taskService.deleteWord(subjectId, sectionId, topicId, id, wordId);
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new HttpException('Client aborted', 499);
      }
      throw error;
    }
  }
}
