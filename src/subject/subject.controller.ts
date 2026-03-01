import { Body, Controller, Delete, Get, HttpException, Param, ParseIntPipe, Post, Put, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { SubjectService } from './subject.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { SubjectUploadDto } from './dto/subject-upload.dto';
import { LiteratureAIGenerate, LiteratureUpdateRequest, SubjectCreateRequest, SubjectUpdateRequest } from './dto/subject-request.dto';
import { FullPlanRequestDto } from './dto/full-plan-request.dto';
import { Request } from 'express';
import { File } from '../file.type';
import { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('subjects')
export class SubjectController {
  constructor(private readonly subjectService: SubjectService) {}

  @UseGuards(JwtAuthGuard)
  @Post(':id/generate')
  async subjectAIPlanGenerate(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: FullPlanRequestDto
  ) {
    const { prompt } = body;
    return this.subjectService.subjectAIPlanGenerate(id, prompt);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findSubjects(
    @Query('withSections') withSections?: string
  ) {
    const withSectionsBool = !(withSections?.toLowerCase() === 'false');
    return this.subjectService.findSubjects(withSectionsBool);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/available')
  async findSubjectsForUser(
    @Req() req: Request
  ) {
    const user: User = (req as any).user;
    const userId: number = user.id;

    return this.subjectService.findSubjectsForUser(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/sections/admin')
  async findAdminSections(
    @Param('id', ParseIntPipe) id: number,
    @Query('withSubject') withSubject?: string,
    @Query('withSections') withSections?: string,
    @Query('withSubtopics') withSubtopics?: string,
    @Query('notStories') notStories?: string,
    @Query('minSectionPart') minSectionPart?: string,
  ) {
    const withSectionsBool = !(withSections?.toLowerCase() === 'false');
    const withSubjectBool = !(withSubject?.toLowerCase() === 'false');
    const withSubtopicsBool = !(withSubtopics?.toLowerCase() === 'false');
    const notStoriesBool =
      notStories === undefined
        ? true
        : notStories.toLowerCase() === 'true';
    const minSectionPartNumber =
      minSectionPart !== undefined && !isNaN(Number(minSectionPart))
        ? Number(minSectionPart)
        : 1;

    return this.subjectService.findAdminSections(id, withSubjectBool, withSectionsBool, withSubtopicsBool, notStoriesBool, minSectionPartNumber);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/literatures')
  async findLiteratures(
    @Param('id', ParseIntPipe) id: number,
    @Query('startPosition') startPosition?: number
  ) {
    return this.subjectService.findLiteratures(id, startPosition !== undefined ? startPosition : 1);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/literature')
  async updateLiteratureByName(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: LiteratureUpdateRequest
  ) {
    return this.subjectService.updateLiteratureByName(id, data);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/literature')
  async findLiteratureByName(
    @Param('id', ParseIntPipe) id: number,
    @Query('name') name: string
  ) {
    return this.subjectService.findLiteratureByName(id, name);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/literature-generate')
  async literatureAIGenerate(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: LiteratureAIGenerate,
    @Req() req: Request
  ) {
    const controller = new AbortController();

    req.on('close', () => controller.abort());

    try {
      return this.subjectService.literatureAIGenerate(id, data);
    }
     catch (error) {
      if (error.name === 'AbortError') {
        throw new HttpException('Client aborted', 499);
      }
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findSubjectById(
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.subjectService.findSubjectById(id);
  }

  @Post()
  async createSubject(
    @Body() data: SubjectCreateRequest
  ) {
    return this.subjectService.createSubject(data);
  }

  @Put(':id')
  async updateSubject(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: SubjectUpdateRequest
  ) {
    return this.subjectService.updateSubject(id, data);
  }

  @Delete(':id')
  async deleteSubject(
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.subjectService.deleteSubject(id);
  }

  @Put(':id/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFileSubject(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file?: File,
    @Body() body?: SubjectUploadDto,
  ) {
    return this.subjectService.uploadFileSubject(id, file, body?.url);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/tasks/:taskId')
  async deleteTask(
    @Param('id', ParseIntPipe) subjectId: number,
    @Param('taskId', ParseIntPipe) id: number,
    @Req() req: Request
  ) {
    const controller = new AbortController();

    req.on('close', () => controller.abort());

    try {
      const user: User = (req as any).user;
      const userId: number = user.id;

      const result = await this.subjectService.deleteTask(userId, subjectId, id);
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new HttpException('Client aborted', 499);
      }
      throw error;
    }
  }
}