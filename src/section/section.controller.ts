import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { SectionService } from './section.service';
import { SectionUpdateRequest } from './dto/section-request.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { User } from '@prisma/client';

@Controller('subjects/:subjectId/sections')
export class SectionController {
  constructor(private readonly sectionService: SectionService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async findSections(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Req() req: Request
  ) {

    const user: User = (req as any).user;
    const userId: number = user.id;

    return this.sectionService.findSections(
      userId,
      subjectId
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findSectionById(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Query('withSubject') withSubject?: string,
    @Query('withTopics') withTopics?: string,
    @Query('withSubtopics') withSubtopics?: string
  ) {
    const withSubjectBool = !(withSubject?.toLowerCase() === 'false');
    const withTopicsBool = !(withTopics?.toLowerCase() === 'false');
    const withSubtopicsBool = !(withSubtopics?.toLowerCase() === 'false');

    const user: User = (req as any).user;
    const userId: number = user.id;

    return this.sectionService.findSectionById(
      userId,
      subjectId,
      id,
      withSubjectBool,
      withTopicsBool,
      withSubtopicsBool
    );
 }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async updateSection(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() data: SectionUpdateRequest
  ) {
    return this.sectionService.updateSection(subjectId, id, data);
  }
}
