import { Body, Controller, Get, Param, ParseIntPipe, Put, Query, Req, UseGuards } from '@nestjs/common';
import { SectionService } from './section.service';
import { SectionUpdateRequest } from './dto/section-request.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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

    return await this.sectionService.findSections(userId, subjectId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findSectionById(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Query('withSubject') withSubject?: string
  ) {
    const withSubjectBool = !(withSubject?.toLowerCase() === 'false');

    return this.sectionService.findSectionById(
      subjectId,
      id,
      withSubjectBool,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('topics/first-uncompleted')
  async findFirstUncompletedTopic(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Req() req: Request
  ) {
    const user: User = (req as any).user;
    const userId: number = user.id;

    return await this.sectionService.findFirstUncompletedTopic(userId, subjectId);
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
