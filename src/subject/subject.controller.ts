import { Body, Controller, Delete, Get, HttpException, Param, ParseIntPipe, Post, Put, Query, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { SubjectService } from './subject.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { SubjectUploadDto } from './dto/subject-upload.dto';
import { SubjectCreateRequest, SubjectUpdateRequest } from './dto/subject-request.dto';
import { FullPlanRequestDto } from './dto/full-plan-request.dto';
import { Request } from 'express';
import { File } from '../file.type';

@Controller('subjects')
export class SubjectController {
  constructor(private readonly subjectService: SubjectService) {}

  @Post(':id/generate')
  async subjectAIPlanGenerate(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: FullPlanRequestDto
  ) {
    const { prompt } = body;
    return this.subjectService.subjectAIPlanGenerate(id, prompt);
  }

  @Get()
  async findSubjects(
    @Query('withSections') withSections?: string
  ) {
    const withSectionsBool = !(withSections?.toLowerCase() === 'false');
    return this.subjectService.findSubjects(withSectionsBool);
  }

  @Get(':id/topics')
  async findTopics(
    @Param('id', ParseIntPipe) id: number,
    @Query('withSubject') withSubject?: string,
    @Query('withSections') withSections?: string,
    @Query('withSubtopics') withSubtopics?: string
  ) {
    const withSectionsBool = !(withSections?.toLowerCase() === 'false');
    const withSubjectBool = !(withSubject?.toLowerCase() === 'false');
    const withSubtopicsBool = !(withSubtopics?.toLowerCase() === 'false');

    return this.subjectService.findTopics(id, withSubjectBool, withSectionsBool, withSubtopicsBool);
  }

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

  @Delete(':id/tasks/:taskId')
  async deleteTask(
    @Param('id', ParseIntPipe) subjectId: number,
    @Param('taskId', ParseIntPipe) id: number,
    @Req() req: Request
  ) {
    const controller = new AbortController();

    req.on('close', () => controller.abort());

    try {
      const result = await this.subjectService.deleteTask(subjectId, id);
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new HttpException('Client aborted', 499);
      }
      throw error;
    }
  }
}