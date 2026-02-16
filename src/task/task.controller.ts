import { Body, Controller, Delete, Get, HttpException, Param, ParseIntPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { TaskService } from './task.service';
import { ChatAIGenerate, InteractiveTaskAIGenerate, OptionsAIGenerate, ProblemsAIGenerate, SolutionAIGenerate, TaskAIGenerate } from './dto/task-generate.dto';
import { SubtopicsProgressUpdateRequest, TaskCreateRequest, TaskUpdateChatRequest, TaskUserSolutionRequest } from './dto/task-request.dto';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { User } from '@prisma/client';

@Controller('subjects/:subjectId/sections/:sectionId/topics/:topicId/tasks')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @UseGuards(JwtAuthGuard)
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

    const user: User = (req as any).user;
    const userId: number = user.id;
    const result = await this.taskService.findTasks(userId, subjectId, sectionId, topicId);

    if (aborted) {
      throw new HttpException('Client aborted', 499);
    }

    return result;
  }

  @UseGuards(JwtAuthGuard)
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

    const user: User = (req as any).user;
    const userId: number = user.id;
    const result = await this.taskService.findPendingTask(userId, subjectId, sectionId, topicId);

    if (aborted) {
      throw new HttpException('Client aborted', 499);
    }

    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id/chat')
  async updateChatTaskById(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() data: TaskUpdateChatRequest,
    @Req() req: Request
  ) {
    let aborted = false;

    req.on('close', () => {
      aborted = true;
    });

    if (aborted) {
      throw new HttpException('Client aborted', 499);
    }

    const user: User = (req as any).user;
    const userId: number = user.id;
    const result = await this.taskService.updateChatTaskById(userId, subjectId, sectionId, topicId, id, data);

    if (aborted) {
      throw new HttpException('Client aborted', 499);
    }

    return result;
  }

  @UseGuards(JwtAuthGuard)
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

    const user: User = (req as any).user;
    const userId: number = user.id;
    const result = await this.taskService.findTaskById(userId, subjectId, sectionId, topicId, id);

    if (aborted) {
      throw new HttpException('Client aborted', 499);
    }

    return result;
  }

  @UseGuards(JwtAuthGuard)
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

    const user: User = (req as any).user;
    const userId: number = user.id;
    const result = await this.taskService.updateTaskUserSolution(userId, subjectId, sectionId, topicId, id, data);

    if (aborted) {
      throw new HttpException('Client aborted', 499);
    }

    return result;
  }

  @UseGuards(JwtAuthGuard)
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
      const user: User = (req as any).user;
      const userId: number = user.id;
      const result = await this.taskService.taskAIGenerate(userId, subjectId, sectionId, topicId, data, controller.signal);
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new HttpException('Client aborted', 499);
      }
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
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
      const user: User = (req as any).user;
      const userId: number = user.id;
      const result = await this.taskService.interactiveTaskAIGenerate(userId, subjectId, sectionId, topicId, data, controller.signal);
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new HttpException('Client aborted', 499);
      }
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
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

  @UseGuards(JwtAuthGuard)
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

  @UseGuards(JwtAuthGuard)
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

  @UseGuards(JwtAuthGuard)
  @Post('chat-generate')
  async chatAIGenerate(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Body() data: ChatAIGenerate,
    @Req() req: Request
  ) {
    const controller = new AbortController();

    req.on('close', () => controller.abort());

    try {
      const result = await this.taskService.chatAIGenerate(subjectId, sectionId, topicId, data, controller.signal);
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new HttpException('Client aborted', 499);
      }
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
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

    const user: User = (req as any).user;
    const userId: number = user.id;
    const result = await this.taskService.createTaskTransaction(userId, subjectId, sectionId, topicId, taskData);

    if (aborted) {
      throw new HttpException('Client aborted', 499);
    }

    return result;
  }

  @UseGuards(JwtAuthGuard)
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

    const user: User = (req as any).user;
    const userId: number = user.id;
    const result = await this.taskService.subtopicsProgressTaskTransaction(userId, subjectId, sectionId, topicId, taskId, data);

    if (aborted) {
      throw new HttpException('Client aborted', 499);
    }

    return result;
  }

  @UseGuards(JwtAuthGuard)
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

    const user: User = (req as any).user;
    const userId: number = user.id;
    const result = await this.taskService.audioTaskTransaction(userId, subjectId, sectionId, topicId, taskId, text, stage, language);

    if (aborted) {
      throw new HttpException('Client aborted', 499);
    }

    return result;
  }

  @UseGuards(JwtAuthGuard)
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
      const user: User = (req as any).user;
      const userId: number = user.id;
      const result = await this.taskService.deleteTask(userId, subjectId, sectionId, topicId, id);
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new HttpException('Client aborted', 499);
      }
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
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
      const user: User = (req as any).user;
      const userId: number = user.id;
      const result = await this.taskService.createWord(userId, subjectId, sectionId, topicId, id, text);
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new HttpException('Client aborted', 499);
      }
      throw error;
    }
  }
}
