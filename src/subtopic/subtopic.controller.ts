import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { SubtopicService } from './subtopic.service';
import { SubtopicCreateRequest, SubtopicUpdateRequest } from 'src/subtopic/dto/subtopic-request.dto';
import { SubtopicsAIGenerate } from './dto/subtopics-generate.dto';

@Controller('subjects/:subjectId/sections/:sectionId/topics/:topicId/subtopics')
export class SubtopicController {
  constructor(private readonly subtopicService: SubtopicService) {}

  @Get()
  async findAllSubtopics(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
  ) {
    return this.subtopicService.findAllSubtopics(subjectId, sectionId, topicId);
  }

  @Post('generate')
  async subtopicsAIGenerate(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Body() data: SubtopicsAIGenerate
  ) {
    return this.subtopicService.subtopicsAIGenerate(subjectId, sectionId, topicId, data);
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
