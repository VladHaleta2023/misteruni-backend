import { Body, Controller, Get, Param, ParseIntPipe, Put, Query } from '@nestjs/common';
import { TopicService } from './topic.service';
import { TopicUpdateRequest } from './dto/topic-request.dto';

@Controller('subjects/:subjectId/sections/:sectionId/topics')
export class TopicController {
  constructor(private readonly topicService: TopicService) {}

  @Get()
  async findAllTopics(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Query('withSubject') withSubject?: string,
    @Query('withSection') withSection?: string,
  ) {
    const withSubjectBool = !(withSubject?.toLowerCase() === 'false');
    const withSectionBool = !(withSection?.toLowerCase() === 'false');
    return this.topicService.findAllTopics(subjectId, sectionId, withSubjectBool, withSectionBool);
  }

  @Get(':id')
  async findTopicById(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('id', ParseIntPipe) id: number,
    @Query('withSubject') withSubject?: string,
    @Query('withSection') withSection?: string,
  ) {
    const withSubjectBool = !(withSubject?.toLowerCase() === 'false');
    const withSectionBool = !(withSection?.toLowerCase() === 'false');
    return this.topicService.findTopicbyId(subjectId, sectionId, id, withSubjectBool, withSectionBool);
  }

  @Put(":id")
  async updateTopic(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() data: TopicUpdateRequest
  ) {
    return this.topicService.updateTopic(subjectId, sectionId, id, data);
  }
}