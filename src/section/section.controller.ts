import { Body, Controller, Get, Param, ParseIntPipe, Put, Query } from '@nestjs/common';
import { SectionService } from './section.service';
import { SectionUpdateRequest } from './dto/section-request.dto';

@Controller('subjects/:subjectId/sections')
export class SectionController {
  constructor(private readonly sectionService: SectionService) {}

  @Get()
  async findSections(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Query('withSubject') withSubject?: string,
    @Query('withTopics') withTopics?: string,
    @Query('withSubtopics') withSubtopics?: string,
    @Query('withPercent') withPercent?: string
  ) {
    const withSubjectBool = !(withSubject?.toLowerCase() === 'false');
    const withTopicsBool = !(withTopics?.toLowerCase() === 'false');
    const withSubtopicsBool = !(withSubtopics?.toLowerCase() === 'false');
    const withPercentBool = !(withPercent?.toLowerCase() === 'false');
    return this.sectionService.findSections(
      subjectId,
      withSubjectBool,
      withTopicsBool,
      withSubtopicsBool,
      withPercentBool
    );
  }

  @Get(':id')
  async findSectionById(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Query('withSubject') withSubject?: string,
    @Query('withTopics') withTopics?: string,
    @Query('withSubtopics') withSubtopics?: string,
    @Query('withPercent') withPercent?: string
  ) {
    const withSubjectBool = !(withSubject?.toLowerCase() === 'false');
    const withTopicsBool = !(withTopics?.toLowerCase() === 'false');
    const withSubtopicsBool = !(withSubtopics?.toLowerCase() === 'false');
    const withPercentBool = !(withPercent?.toLowerCase() === 'false');
    return this.sectionService.findSectionById(
      subjectId,
      id,
      withSubjectBool,
      withTopicsBool,
      withSubtopicsBool,
      withPercentBool
    );
 }

  @Put(':id')
  async updateSection(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() data: SectionUpdateRequest
  ) {
    return this.sectionService.updateSection(subjectId, id, data);
  }
}
