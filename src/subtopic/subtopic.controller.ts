import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { SubtopicService } from './subtopic.service';
import { SubtopicCreateRequest } from 'src/subject/dto/subtopic-request.dto';

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
  @Get(':id')
  async findSubtopicById(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.subtopicService.findSubtopicById(subjectId, sectionId, topicId, id);
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

  @Delete()
  async deleteSubtopic(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.subtopicService.deleteSubtopic(subjectId, sectionId, topicId, id);
  }
}
