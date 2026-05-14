import { Controller, Get, HttpException, Param, ParseIntPipe, Req, UseGuards } from '@nestjs/common';
import { ExamService } from './exam.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { User } from '@prisma/client';

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

  /*@UseGuards(JwtAuthGuard)*/
  
}
