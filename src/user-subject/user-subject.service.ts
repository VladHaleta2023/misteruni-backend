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
                message: `Pobieranie wybranych przedmiotów pomyślnie`,
                subjects
            };
        }
        catch (error) {
            throw new InternalServerErrorException('Błąd podczas pobierania wybranych przedmiotów użytkownika');
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
                throw new NotFoundException('Przedmiot nie został znaleziony dla tego użytkownika');
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
                message: `Pobieranie wybranych przedmiotów pomyślnie`,
                subject: userSubject
            };
        }
        catch (error) {
            throw new InternalServerErrorException('Błąd podczas pobierania wybranego przedmiotu użytkownika');
        }
    }

    async createUserSubject(
        userId: number,
        id: number,
        data: UserSubjectCreateRequest
    ) {
        try {
            const adminUser: User | null = await this.prismaService.user.findFirst({
                where: { role: "ADMIN" }
            });

            const adminUserId = adminUser?.id ?? 1;

            const subject = await this.prismaService.subject.findUnique({
                where: { id }
            });
            
            if (!subject) {
                throw new NotFoundException('Przedmiot nie został znaleziony dla tego użytkownika');
            }
            
            const result = await this.prismaService.$transaction(async (tx) => {
                const userSubject = await tx.userSubject.create({
                    data: {
                        subjectId: id,
                        userId,
                        ...data
                    }
                });

                const userWordsCount = await tx.word.count({
                    where: {
                        userId,
                        subjectId: id,
                        topicId: { not: null }
                    }
                });

                console.log(`User has ${userWordsCount} words with topics for subject ${id}`);

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
                        WHERE w."subjectId" = ${id}
                        AND w."userId" = ${adminUserId}
                        AND w."topicId" IS NOT NULL
                        ON CONFLICT ("userId", "subjectId", "text") 
                        DO NOTHING
                    `;
                }

                return userSubject;
            }, {
                timeout: 900000
            });

            return {
                statusCode: 200,
                message: `Dodawanie wybranego przedmiotu użytkownika pomyślnie`,
                subject: result
            }
        }
        catch (error) {
            console.error('Error in createUserSubject:', error);
            throw new InternalServerErrorException(
                `Błąd podczas dodawania wybranego przedmiotu użytkownika: ${error.message}`
            );
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
                throw new NotFoundException('Przedmiot nie został znaleziony dla tego użytkownika');
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
                message: `Usuwanie wybranego przedmiotu użytkownika pomyślnie`,
                subject: userSubject
            }
        }
        catch (error) {
            throw new InternalServerErrorException('Błąd podczas usuwania wybranego przedmiotu użytkownika');
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
                throw new NotFoundException('Przedmiot nie został znaleziony dla tego użytkownika');
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
                message: `Aktualizacja wybranego przedmiotu użytkownika pomyślnie`,
                subject: userSubject
            }
        }
        catch (error) {
            throw new InternalServerErrorException('Błąd podczas aktualizacji wybranego przedmiotu użytkownika');
        }
    }
}
