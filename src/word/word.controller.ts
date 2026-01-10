import { Body, Controller, Delete, Get, HttpException, Param, ParseIntPipe, Post, Put, Query, Req } from '@nestjs/common';
import { WordService } from './word.service';
import { VocabluaryAIGenerate } from 'src/task/dto/task-generate.dto';
import { Request } from 'express';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { User } from '@prisma/client';

@Controller('subjects/:subjectId/words')
export class WordController {
  constructor(
    private readonly wordService: WordService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async fetchWords(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Req() req: Request,
    @Body('topicId') topicId?: number | null,
    @Body('taskId') taskId?: number | null
  ) {
    const user: User = (req as any).user;
    const userId: number = user.id;

    return this.wordService.fetchWords(userId, subjectId, topicId, taskId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('admin')
  async adminFetchWords(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Req() req: Request,
    @Body('topicId') topicId?: number | null,
    @Body('taskId') taskId?: number | null
  ) {
    const user: User = (req as any).user;
    const userId: number = user.id;

    return this.wordService.adminFetchWords(userId, subjectId, topicId, taskId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('find')
  async findWords(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Body('wordIds') wordIds: number[],
    @Req() req: Request,
  ) {
    const user: User = (req as any).user;
    const userId: number = user.id;

    return this.wordService.findWords(userId, subjectId, wordIds);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteWord(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    const user: User = (req as any).user;
    const userId: number = user.id;

    return await this.wordService.deleteWord(userId, subjectId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Put('update')
  async updateWords(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Body('outputWords') outputWords: string[],
    @Body('wordIds') wordIds: number[],
    @Req() req: Request,
  ) {
    const user: User = (req as any).user;
    const userId: number = user.id;

    return await this.wordService.updateWords(
      userId,
      subjectId,
      outputWords,
      wordIds
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('vocabluary-generate')
  async vocabluaryAIGenerate(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Body() body: {
      sectionId?: number | null;
      topicId?: number | null;
      data: VocabluaryAIGenerate;
    },
    @Req() req: Request
  ) {
    const controller = new AbortController();

    req.on('close', () => controller.abort());

    const sectionId: number | null = body.sectionId ?? null;
    const topicId: number | null = body.topicId ?? null;
    const data = body.data;

    try {
      const result = await this.wordService.vocabluaryAIGenerate(subjectId, data, sectionId, topicId, controller.signal);
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new HttpException('Client aborted', 499);
      }
      throw error;
    }
  }
}
