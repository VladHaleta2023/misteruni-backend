import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import { UserSubjectService } from './user-subject.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { User } from '@prisma/client';
import { UserSubjectCreateRequest, UserSubjectUpdateRequest } from './dto/user-subject-request.dto';

@Controller('user-subjects')
export class UserSubjectController {
  constructor(private readonly userSubjectService: UserSubjectService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async findUserSubjects(
    @Req() req: Request
  ) {
    const user: User = (req as any).user;
    const userId: number = user.id;
    
    return this.userSubjectService.findUserSubjects(userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findUserSubjectById(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number
  ) {
    const user: User = (req as any).user;
    const userId: number = user.id;

    return this.userSubjectService.findUserSubjectById(userId, id);
  }

  @Post(':id')
  @UseGuards(JwtAuthGuard)
  async createUserSubject(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UserSubjectCreateRequest
  ) {
    const user: User = (req as any).user;
    const userId: number = user.id;

    return this.userSubjectService.createUserSubject(userId, id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteUserSubject(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number
  ) {
    const user: User = (req as any).user;
    const userId: number = user.id;

    return this.userSubjectService.deleteUserSubject(userId, id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async updateUserSubject(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UserSubjectUpdateRequest
  ) {
    const user: User = (req as any).user;
    const userId: number = user.id;

    return this.userSubjectService.updateUserSubject(userId, id, dto);
  }
}
