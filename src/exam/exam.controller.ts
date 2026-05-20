import { Body, Controller, Get, HttpException, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ExamService } from './exam.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { User } from '@prisma/client';
import { ExamAIGenerate } from './dto/exam-generate.dto';
import { ExamCreateRequest } from './dto/exam-request.dto';

@Controller('subjects/:subjectId/exams')
export class ExamController {
  constructor(private readonly examService: ExamService) {}

  @UseGuards(JwtAuthGuard)
  @Get('pending')
  async findLastExam(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Req() req: Request
  ) {
    let aborted = false;

    req.on('close', () => {
      aborted = true;
    });

    if (aborted) {
      throw new HttpException('Client aborted', 499);
    }

    const user: User = (req as any).user;
    const userId: number = user.id;
    const result = await this.examService.findLastExam(userId, subjectId);

    if (aborted) {
      throw new HttpException('Client aborted', 499);
    }

    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Get(':examId')
  async findExamById(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Param('examId', ParseIntPipe) examId: number,
    @Req() req: Request
  ) {
    let aborted = false;

    req.on('close', () => {
      aborted = true;
    });

    if (aborted) {
      throw new HttpException('Client aborted', 499);
    }

    const user: User = (req as any).user;
    const userId: number = user.id;
    const result = await this.examService.findExamById(userId, subjectId, examId);

    if (aborted) {
      throw new HttpException('Client aborted', 499);
    }

    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async findExams(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Req() req: Request
  ) {
    let aborted = false;

    req.on('close', () => {
      aborted = true;
    });

    if (aborted) {
      throw new HttpException('Client aborted', 499);
    }

    const user: User = (req as any).user;
    const userId: number = user.id;
    const result = await this.examService.findExams(userId, subjectId);

    if (aborted) {
      throw new HttpException('Client aborted', 499);
    }

    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post('exam-generate')
  async examAIGenerate(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Body() data: ExamAIGenerate,
    @Req() req: Request
  ) {
    const controller = new AbortController();

    req.on('close', () => controller.abort());

    try {
      const user: User = (req as any).user;
      const userId: number = user.id;

      const result = await this.examService.examAIGenerate(userId, subjectId, data, controller.signal);
      return result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new HttpException('Client aborted', 499);
      }
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('exam-transaction')
  async upsertExamTransaction(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @Body() examData: ExamCreateRequest,
    @Req() req: Request
  ) {
    let aborted = false;

    req.on('close', () => {
      aborted = true;
    });

    if (aborted) {
      throw new HttpException('Client aborted', 499);
    }

    const user: User = (req as any).user;
    const userId: number = user.id;
    const result = await this.examService.createExamTransaction(userId, subjectId, examData);

    if (aborted) {
      throw new HttpException('Client aborted', 499);
    }

    return result;
  }
}
