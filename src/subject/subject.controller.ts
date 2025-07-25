import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { SubjectService } from './subject.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { SubjectUploadDto } from './dto/subject-upload.dto';
import { SubjectCreateRequest, SubjectUpdateRequest } from './dto/subject-request.dto';
import { FullPlanRequestDto } from './dto/full-plan-request.dto';

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
    @UploadedFile() file?: Express.Multer.File,
    @Body() body?: SubjectUploadDto,
  ) {
    return this.subjectService.uploadFileSubject(id, file, body?.url);
  }
}