import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { TopicService } from './topic.service';

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
}