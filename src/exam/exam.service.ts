import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ExamService {
    constructor(
        private readonly prismaService: PrismaService
    ) {}

    async findLastExam(
        userId: number,
        subjectId: number
    ) {

    }
}
