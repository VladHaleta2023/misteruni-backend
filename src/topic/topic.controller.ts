import { Body, Controller, Delete, Get, HttpException, Param, ParseIntPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { TopicService } from './topic.service';
import { TopicUpdateRequest, WordsAIGenerate } from './dto/topic-request.dto';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { User } from '@prisma/client';

@Controller('subjects/:subjectId/sections/:sectionId/topics')
export class TopicController {
  constructor(private readonly topicService: TopicService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async findTopics(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Query('withSubject') withSubject?: string,
    @Query('withSection') withSection?: string,
  ) {
    const withSubjectBool = !(withSubject?.toLowerCase() === 'false');
    const withSectionBool = !(withSection?.toLowerCase() === 'false');
    return this.topicService.findTopics(subjectId, sectionId, withSubjectBool, withSectionBool);
  }

  @UseGuards(JwtAuthGuard)
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

  @UseGuards(JwtAuthGuard)
  @Get(':id/completed')
  async findTopicCompletedById(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request
  ) {
    const user: User = (req as any).user;
    const userId: number = user.id;

    return this.topicService.findTopicCompletedById(userId, subjectId, sectionId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Put(":id")
  async updateTopicTransaction(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() data: TopicUpdateRequest
  ) {
    return this.topicService.updateTopicTransaction(subjectId, sectionId, id, data);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/words/words-generate')
  async wordsAIGenerate(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('id', ParseIntPipe) topicId: number,
    @Body() data: WordsAIGenerate,
    @Req() req: Request
  ) {
    const controller = new AbortController();
    
    req.on('close', () => controller.abort());

    try {
      const result = await this.topicService.wordsAIGenerate(subjectId, sectionId, topicId, data);
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new HttpException('Client aborted', 499);
      }
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/words')
  async createWordsByTopicId(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('id', ParseIntPipe) topicId: number,
    @Body('words') words: [string, number][],
    @Req() req: Request,
  ) {
    const user: User = (req as any).user;
    const userId: number = user.id;

    return this.topicService.createWordsByTopicId(userId, subjectId, sectionId, topicId, words);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/words')
  async deleteWordsByTopicId(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('sectionId', ParseIntPipe) sectionId: number,
    @Param('id', ParseIntPipe) topicId: number,
    @Req() req: Request,
  ) {
    const user: User = (req as any).user;
    const userId: number = user.id;

    return this.topicService.deleteWordsByTopicId(userId, subjectId, sectionId, topicId);
  }
}