import { BadRequestException, Body, Controller, Delete, Get, HttpException, Param, ParseArrayPipe, ParseIntPipe, Post, Put, Query, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { SubtopicService } from './subtopic.service';
import { SubtopicCreateRequest, SubtopicUpdateRequest, UpdateSubtopicsDto } from '../subtopic/dto/subtopic-request.dto';
import { FrequencyAIGenerate, SubtopicsAIGenerate, SubtopicsStatusAIGenerate, TopicExpansionAIGenerate } from './dto/subtopics-generate.dto';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { User } from '@prisma/client';

@Controller('subjects/:subjectId/sections/:sectionId/topics/:topicId/subtopics')
export class SubtopicController {
  constructor(private readonly subtopicService: SubtopicService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async findSubtopics(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Req() req: Request
  ) {
    const user: User = (req as any).user;
    const userId: number = user.id;
    
    return this.subtopicService.findSubtopics(userId, subjectId, sectionId, topicId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin')
  async findAdminSubtopics(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Req() req: Request
  ) {
    return this.subtopicService.findAdminSubtopics(subjectId, sectionId, topicId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/status')
  async findAdminSubtopicsStatus(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number
  ) {
    return this.subtopicService.findAdminSubtopicsStatus(subjectId, sectionId, topicId);
  }

  @UseGuards(JwtAuthGuard)
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

  @UseGuards(JwtAuthGuard)
  @Post('status-generate')
  async subtopicsStatusAIGenerate(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Body() data: SubtopicsStatusAIGenerate,
    @Req() req: Request
  ) {
    const controller = new AbortController();
    
    req.on('close', () => controller.abort());

    try {
      const result = await this.subtopicService.subtopicsStatusAIGenerate(subjectId, sectionId, topicId, data);
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new HttpException('Client aborted', 499);
      }
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('topic-expansion-generate')
  async topicExpansionAIGenerate(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Body() data: TopicExpansionAIGenerate,
    @Req() req: Request
  ) {
    const controller = new AbortController();
    
    req.on('close', () => controller.abort());

    try {
      const result = await this.subtopicService.topicExpansionAIGenerate(subjectId, sectionId, topicId, data);
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new HttpException('Client aborted', 499);
      }
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('frequency-generate')
  async frequencyAIGenerate(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Body() data: FrequencyAIGenerate,
    @Req() req: Request
  ) {
    const controller = new AbortController();
    
    req.on('close', () => controller.abort());

    try {
      const result = await this.subtopicService.frequencyAIGenerate(subjectId, sectionId, topicId, data);
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new HttpException('Client aborted', 499);
      }
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findSubtopicById(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.subtopicService.findSubtopicById(subjectId, sectionId, topicId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('name/:name')
  async findSubtopicByName(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Param('name') name: string,
  ) {
    return this.subtopicService.findSubtopicByName(subjectId, sectionId, topicId, name);
  }

  @UseGuards(JwtAuthGuard)
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

  @UseGuards(JwtAuthGuard)
  @Post()
  async createSubtopic(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Body() data: SubtopicCreateRequest
  ) {
    return this.subtopicService.createSubtopic(subjectId, sectionId, topicId, data);
  }

  @UseGuards(JwtAuthGuard)
  @Post('admin/bulk')
  async createSubtopics(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Body() body: { subtopics: [string, number][] }
  ) {
    const subtopics = body.subtopics;
    return this.subtopicService.createSubtopics(subjectId, sectionId, topicId, subtopics);
  }

  @UseGuards(JwtAuthGuard)
  @Put('admin/update')
  async updateSubtopics(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Body() body: { subtopics: [string, string][] }
  ) {
    const subtopics = body.subtopics;
    return this.subtopicService.updateSubtopics(subjectId, sectionId, topicId, subtopics);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteSubtopic(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.subtopicService.deleteSubtopic(subjectId, sectionId, topicId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete()
  async deleteSubtopics(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('topicId', ParseIntPipe) topicId: number
  ) {
    return this.subtopicService.deleteSubtopics(subjectId, sectionId, topicId);
  }
}
