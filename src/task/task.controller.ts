import { Body, Controller, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { TaskService } from './task.service';
import { OptionsAIGenerate, ProblemsAIGenerate, SolutionAIGenerate, TaskAIGenerate } from './dto/task-generate.dto';
import { TaskCreateRequest } from './dto/task-request.dto';

@Controller('subjects/:subjectId/sections/:sectionId/topics/:topicId/tasks')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Get()
  async findAllTasks(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
  ) {
    return this.taskService.findAllTasks(subjectId, sectionId, topicId);
  }

  @Get('pending')
  async findPendingTask(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number
  ) {
    return this.taskService.findPendingTask(subjectId, sectionId, topicId);
  }

  @Get(':id')
  async findTaskById(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.taskService.findTaskById(subjectId, sectionId, topicId, id);
  }

  @Post('task-generate')
  async taskAIGenerate(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Body() data: TaskAIGenerate
  ) {
    return this.taskService.taskAIGenerate(subjectId, sectionId, topicId, data);
  }

  @Post('solution-generate')
  async solutionAIGenerate(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Body() data: SolutionAIGenerate
  ) {
    return this.taskService.solutionAIGenerate(subjectId, sectionId, topicId, data);
  }

  @Post('options-generate')
  async optionsAIGenerate(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Body() data: OptionsAIGenerate
  ) {
    return this.taskService.optionsAIGenerate(subjectId, sectionId, topicId, data);
  }

  @Post('problems-generate')
  async problemsAIGenerate(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Body() data: ProblemsAIGenerate
  ) {
    return this.taskService.problemsAIGenerate(subjectId, sectionId, topicId, data);
  }

  @Post('task-transaction')
  async createTaskTransaction(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Body() taskData: TaskCreateRequest
  ) {
    return this.taskService.createTaskTransaction(subjectId, sectionId, topicId, taskData);
  }
}
