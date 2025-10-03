import { Body, Controller, Delete, Get, HttpException, Param, ParseIntPipe, Post, Put, Query, Req } from '@nestjs/common';
import { SubtopicService } from './subtopic.service';
import { SubtopicCreateRequest, SubtopicUpdateRequest } from 'src/subtopic/dto/subtopic-request.dto';
import { SubtopicsAIGenerate } from './dto/subtopics-generate.dto';
import { Request } from 'express';

@Controller('subjects/:subjectId/sections/:sectionId/topics/:topicId/subtopics')
export class SubtopicController {
  constructor(private readonly subtopicService: SubtopicService) {}

  @Get()
  async findSubtopics(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Query('weekOffset') weekOffset?: string,
  ) {
    const weekOffsetInt = Number(weekOffset) || 0;
    return this.subtopicService.findSubtopics(subjectId, sectionId, topicId, weekOffsetInt);
  }

  @Post('generate')
  async subtopicsAIGenerate(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Body() data: SubtopicsAIGenerate,
    @Req() req: Request
  ) {
    const controller = new AbortController();
    
    req.on('close', () => controller.abort());

    try {
      const result = await this.subtopicService.subtopicsAIGenerate(subjectId, sectionId, topicId, data);
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new HttpException('Client aborted', 499);
      }
      throw error;
    }
  }

  @Get(':id')
  async findSubtopicById(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.subtopicService.findSubtopicById(subjectId, sectionId, topicId, id);
  }

  @Get('name/:name')
  async findSubtopicByName(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Param('name') name: string,
  ) {
    return this.subtopicService.findSubtopicByName(subjectId, sectionId, topicId, name);
  }

  @Put(':id')
  async updateSubtopic(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() data: SubtopicUpdateRequest
  ) {
    return this.subtopicService.updateSubtopic(subjectId, sectionId, topicId, id, data);
  }

  @Post()
  async createSubtopic(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Body() data: SubtopicCreateRequest
  ) {
    return this.subtopicService.createSubtopic(subjectId, sectionId, topicId, data);
  }

  @Post('bulk')
  async createSubtopics(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Body() body: { subtopics: [string, number][] }
  ) {
    const subtopics = body.subtopics;
    return this.subtopicService.createSubtopics(subjectId, sectionId, topicId, subtopics);
  }

  @Delete(':id')
  async deleteSubtopic(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.subtopicService.deleteSubtopic(subjectId, sectionId, topicId, id);
  }

  @Delete()
  async deleteSubtopics(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number
  ) {
    return this.subtopicService.deleteSubtopics(subjectId, sectionId, topicId);
  }
}
