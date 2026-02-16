import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserSubjectCreateRequest, UserSubjectUpdateRequest } from './dto/user-subject-request.dto';
import { User } from '@prisma/client';

@Injectable()
export class UserSubjectService {
    constructor(
        private readonly prismaService: PrismaService
    ) {}

    async findUserSubjects(
        userId: number
    ) {
        try {
            const subjects = await this.prismaService.userSubject.findMany({
                where: {
                    userId
                },
                include: {
                    subject: true
                },
                orderBy: {
                    createdAt: "asc"
                }
            })
            
            return {
                statusCode: 200,
                message: `Pobieranie przedmiotów pomyślnie`,
                subjects
            };
        }
        catch (error) {
            throw new InternalServerErrorException('Błąd podczas pobierania przedmiotów');
        }
    }

    async findUserSubjectById(
        userId: number,
        id: number
    ) {
        try {
            const subject = await this.prismaService.subject.findUnique({
                where: {
                    id
                }
            });
            
            if (!subject) {
                throw new NotFoundException('Przedmiot nie został znaleziony');
            }

            const userSubject = await this.prismaService.userSubject.findUnique({
                where: {
                    userId_subjectId: {
                        userId,
                        subjectId: id
                    }
                },
                include: {
                    subject: true
                },
            });
            
            return {
                statusCode: 200,
                message: `Pobieranie przedmiotu pomyślnie`,
                subject: userSubject
            };
        }
        catch (error) {
            throw new InternalServerErrorException('Błąd podczas pobierania przedmiotu');
        }
    }

    async createUserSubject(
        userId: number,
        subjectId: number,
        data: UserSubjectCreateRequest
    ) {
        try {
            const adminUser = await this.prismaService.user.findFirst({
                where: { role: "ADMIN" },
                select: { id: true }
            });

            const adminUserId = adminUser?.id ?? 1;

            const subject = await this.prismaService.subject.findUnique({
                where: { id: subjectId }
            });

            if (!subject) {
                throw new NotFoundException('Przedmiot nie został znaleziony');
            }

            const result = await this.prismaService.$transaction(async (tx) => {
                const userSubject = await tx.userSubject.create({
                    data: {
                    userId,
                    subjectId,
                    ...data
                    }
                });

                const userWordsCount = await tx.word.count({
                    where: {
                    userId,
                    subjectId,
                    topicId: { not: null }
                    }
                });

                if (userWordsCount === 0) {
                    await tx.$executeRaw`
                    INSERT INTO "Word" (
                        "text",
                        "frequency",
                        "userId",
                        "subjectId",
                        "topicId",
                        "updatedAt"
                    )
                    SELECT
                        w."text",
                        w."frequency",
                        ${userId},
                        w."subjectId",
                        w."topicId",
                        COALESCE(w."updatedAt", NOW())
                    FROM "Word" w
                    WHERE w."subjectId" = ${subjectId}
                        AND w."userId" = ${adminUserId}
                        AND w."topicId" IS NOT NULL
                    ON CONFLICT ("userId", "subjectId", "text") DO NOTHING
                    `;
                }

                await tx.$executeRaw`
                    INSERT INTO "UserSection" (
                        "userId", "subjectId", "sectionId", "percent", "updatedAt"
                    )
                    SELECT
                        ${userId},
                        s."subjectId",
                        s."id",
                        0,
                        NOW()
                    FROM "Section" s
                    WHERE s."subjectId" = ${subjectId}
                    ON CONFLICT ("userId", "subjectId", "sectionId") DO NOTHING
                `;

                await tx.$executeRaw`
                    INSERT INTO "UserTopic" (
                        "userId", "subjectId", "sectionId", "topicId", "percent", "updatedAt"
                    )
                    SELECT
                        ${userId},
                        t."subjectId",
                        t."sectionId",
                        t."id",
                        0,
                        NOW()
                    FROM "Topic" t
                    WHERE t."subjectId" = ${subjectId}
                    ON CONFLICT ("userId", "subjectId", "topicId") DO NOTHING
                `;

                await tx.$executeRaw`
                    INSERT INTO "UserSubtopic" (
                        "userId", "subjectId", "sectionId", "topicId", "subtopicId", "percent", "updatedAt"
                    )
                    SELECT
                        ${userId},
                        s."subjectId",
                        s."sectionId",
                        s."topicId",
                        s."id",
                        0,
                        NOW()
                    FROM "Subtopic" s
                    WHERE s."subjectId" = ${subjectId}
                    ON CONFLICT ("userId", "subjectId", "subtopicId") DO NOTHING
                `;

                return userSubject;
            }, { timeout: 900000 });

            return {
                statusCode: 200,
                message: 'Dodawanie przedmiotu pomyślnie',
                subject: result
            };
        } catch (error) {
            throw new InternalServerErrorException(`Błąd podczas dodawania przedmiotu: ${error.message}`);
        }
    }

    async deleteUserSubject(
        userId: number,
        id: number
    ) {
        try {
            const subject = await this.prismaService.subject.findUnique({
                where: {
                    id
                }
            });
            
            if (!subject) {
                throw new NotFoundException('Przedmiot nie został znaleziony');
            }

            const userSubject = await this.prismaService.userSubject.delete({
                where: {
                    userId_subjectId: {
                        subjectId: id,
                        userId
                    }
                }
            })

            return {
                statusCode: 200,
                message: `Usuwanie przedmiotu pomyślnie`,
                subject: userSubject
            }
        }
        catch (error) {
            throw new InternalServerErrorException('Błąd podczas usuwania przedmiotu');
        }
    }

    async updateUserSubject(
        userId: number,
        id: number,
        data: UserSubjectUpdateRequest
    ) {
        try {
            const subject = await this.prismaService.subject.findUnique({
                where: {
                    id
                }
            });
            
            if (!subject) {
                throw new NotFoundException('Przedmiot nie został znaleziony');
            }

            const userSubject = await this.prismaService.userSubject.update({
                where: {
                    userId_subjectId: {
                        subjectId: id,
                        userId
                    }
                },
                data
            })

            return {
                statusCode: 200,
                message: `Aktualizacja przedmiotu pomyślnie`,
                subject: userSubject
            }
        }
        catch (error) {
            throw new InternalServerErrorException('Błąd podczas aktualizacji przedmiotu');
        }
    }
}
