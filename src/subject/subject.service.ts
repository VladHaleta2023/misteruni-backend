import { BadRequestException, HttpException, HttpStatus, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubjectCreateRequest, SubjectUpdateRequest } from './dto/subject-request.dto';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { StorageService } from '../storage/storage.service';
import axios from "axios";
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { File } from '../file.type';

@Injectable()
export class SubjectService {
    private readonly fastapiUrl: string | undefined;

    constructor(
        private readonly prismaService: PrismaService,
        private readonly httpService: HttpService,
        private readonly storageService: StorageService,
        private readonly configService: ConfigService
    ) {
        const node_env = this.configService.get<string>('APP_ENV') || 'development';

        if (node_env === 'development') {
            this.fastapiUrl = this.configService.get<string>('FASTAPI_URL_LOCAL') || undefined;
            }
        else {
            this.fastapiUrl = this.configService.get<string>('FASTAPI_URL') || undefined;
        }
    }

    async calculateSubtopicsPercent(
        userId: number,
        subjectId: number,
        sectionId?: number,
        topicId?: number,
    ) {
        const whereClause: any = { subjectId };
        if (sectionId) whereClause.sectionId = sectionId;
        if (topicId) whereClause.topicId = topicId;

        const subtopics = await this.prismaService.subtopic.findMany({
            where: whereClause,
            include: {
                progresses: {
                    where: { userId, task: { finished: true, userId } },
                },
            },
        });

        const updatedSubtopics = await Promise.all(
            subtopics.map(async (subtopic) => {
                const progresses = subtopic.progresses || [];
                const percent =
                    progresses.length > 0
                        ? Math.round(progresses.reduce((acc, p) => acc + p.percent, 0) / progresses.length)
                        : 0;

                return { ...subtopic, percent };
            }),
        );

        return updatedSubtopics;
    }

    async deleteAllSectionsBySubjectId(id: number) {
        try {
            await this.prismaService.section.deleteMany({
                where: {
                    subjectId: id
                }
            });
        }
        catch (error) {
            console.error('Błąd usuwania działów przedmiota:', error);
            throw error;
        }
    }

    async subjectAIPlanGenerate(id: number, prompt: string) {
        const url = `${this.fastapiUrl}/admin/full-plan-generate`;

        try {
            const response$ = this.httpService.post(url, { prompt });
            const response = await firstValueFrom(response$);

            if (!response.data || !response.data.sections) {
                throw new BadRequestException('Niepoprawna struktura odpowiedzi z serwera.');
            }

            return await this.prismaService.$transaction(async (tx) => {
                await tx.section.deleteMany({
                    where: { subjectId: id },
                });

                for (let i = 0; i < response.data.sections.length; i++) {
                    const section = response.data.sections[i];

                    const createdSection = await tx.section.create({
                        data: {
                            name: section.section,
                            subjectId: id,
                            partId: i + 1,
                        },
                    });

                    if (section.topics && section.topics.length > 0) {
                        const topicsData = section.topics.map((topicName: string, index: number) => ({
                            name: topicName,
                            sectionId: createdSection.id,
                            subjectId: id,
                            partId: index + 1,
                        }));

                        await tx.topic.createMany({
                            data: topicsData,
                        });
                    }
                }

                return {
                    statusCode: 201,
                    message: "Generacja treści przedmiotu udana",
                    sections: response.data.sections
                };
            }, {
                timeout: 900000
            });
        }
        catch (error) {
            if (error.response && error.response.data) {
                const fastApiErrorMessage = error.response.data.detail || JSON.stringify(error.response.data);
                throw new HttpException(`Błąd API: ${fastApiErrorMessage}`, HttpStatus.INTERNAL_SERVER_ERROR);
            }
            throw new InternalServerErrorException(`Błąd serwisu generującego: ${error.message || error.toString()}`);
        }
    }
    
    async findSubjects(withSections: boolean = true) {
        try {
            if (!withSections) {
            const subjects = await this.prismaService.subject.findMany({
                orderBy: { createdAt: 'asc' },
            });

            return {
                statusCode: 200,
                message: 'Pobrano listę przedmiotów pomyślnie',
                subjects: subjects.map(s => ({ ...s, sections: [] })),
            };
            }

            const subjects = await this.prismaService.$queryRaw<
            {
                id: number;
                name: string;
                createdAt: Date;
                sections: {
                id: number;
                name: string;
                partId: number;
                topics: {
                    id: number;
                    name: string;
                    partId: number;
                }[];
                }[];
            }[]
            >`
            SELECT
            s.id,
            s.name,
            s."createdAt",
            COALESCE(
                (
                SELECT json_agg(
                    json_build_object(
                    'id', sec.id,
                    'name', sec.name,
                    'partId', sec."partId",
                    'topics', COALESCE(
                        (
                        SELECT json_agg(
                            json_build_object(
                            'id', t.id,
                            'name', t.name,
                            'partId', t."partId"
                            )
                            ORDER BY t."partId"
                        )
                        FROM "Topic" t
                        WHERE t."sectionId" = sec.id
                        ),
                        '[]'::json
                    )
                    )
                    ORDER BY sec."partId"
                )
                FROM "Section" sec
                WHERE sec."subjectId" = s.id
                ),
                '[]'::json
            ) AS sections
            FROM "Subject" s
            ORDER BY s."createdAt" ASC;
            `;

            return {
                statusCode: 200,
                message: 'Pobrano listę przedmiotów pomyślnie',
                subjects,
            };
        } catch (error) {
            throw new BadRequestException('Nie udało się pobrać przedmiotów');
        }
    }

    async findSubjectsForUser(
        userId: number
    ) {
        type AvailableSubject = {
            id: number;
            name: string;
        }

        try {
            const availableSubjects = await this.prismaService.$queryRaw<AvailableSubject[]>`
                SELECT 
                    s.id,
                    s.name
                FROM "Subject" s
                WHERE s."isVisible" = true
                AND NOT EXISTS (
                    SELECT 1 
                    FROM "UserSubject" us 
                    WHERE us."subjectId" = s.id 
                    AND us."userId" = ${userId}
                )
                ORDER BY s."createdAt" ASC
            `;

            return {
                statusCode: 200,
                message: 'Pobrano listę przedmiotów dla użytkownika pomyślnie',
                subjects: availableSubjects,
            };
        } catch (error) {
            throw new BadRequestException('Nie udało się pobrać przedmiotów dla użytkownika');
        }
    }

    async findSubjectById(id: number) {
        try {
            const subject = await this.prismaService.subject.findUnique({
                where: { id },
            });

            if (!subject) {
                return {
                    statusCode: 404,
                    message: `Przedmiot nie został znaleziony`,
                    subject: null,
                };
            }

            return {
                statusCode: 200,
                message: "Przedmiot został pomyślnie pobrany",
                subject: {
                    ...subject,
                    subtopicsPromptOwn: true,
                    subtopicsStatusPromptOwn: true,
                    questionPromptOwn: true,
                    solutionPromptOwn: true,
                    answersPromptOwn: true,
                    closedSubtopicsPromptOwn: true,
                    subQuestionsPromptOwn: true,
                    vocabluaryPromptOwn: true,
                    wordsPromptOwn: true,
                    topicExpansionPromptOwn: true
                }
            };
        } catch (error) {
            console.error(`Nie udało się pobrać przedmiotu:`, error);
            throw new InternalServerErrorException("Błąd podczas pobierania przedmiotu");
        }
    }

    async createSubject(data: SubjectCreateRequest) {
        try {
            const newSubject = await this.prismaService.subject.create({
                data: {
                    name: data.name,
                    prompt: data.prompt || '',
                },
            });

            return {
                statusCode: 201,
                message: 'Przedmiot został pomyślnie dodany',
                subject: newSubject,
            };
        }
        catch (error) {
            console.error(`Nie udało się dodać przedmiot:`, error);
            throw new InternalServerErrorException('Błąd podczas dodawania przedmiotu');
        }
    }

    async updateSubject(id: number, data: SubjectUpdateRequest) {
        try {
            const existing = await this.prismaService.subject.findUnique({ where: { id } });
            if (!existing) {
                return {
                    statusCode: 404,
                    message: `Przedmiot nie został znaleziony`,
                };
            }

            const filteredData = Object.fromEntries(
                Object.entries(data).filter(([_, value]) => value !== undefined)
            );

            const updatedSubject = await this.prismaService.subject.update({
                where: { id },
                data: filteredData
            });

            return {
                statusCode: 200,
                message: 'Przedmiot został pomyślnie zaktualizowany',
                subject: updatedSubject,
            };
        }
        catch (error) {
            console.error(`Nie udało się zaktualizować przedmiot:`, error);
            throw new InternalServerErrorException('Błąd podczas aktualizacji przedmiotu');
        }
    }

    private extractKeyFromUrl(fileUrl: string): string | null {
        try {
            const url = new URL(fileUrl);
            return decodeURIComponent(url.pathname.substring(1));
        } catch (e) {
            console.error('Nie udało się wyciągnąć klucza z URL:', e);
            return null;
        }
    }

    async deleteSubject(id: number) {
        try {
            const existing = await this.prismaService.subject.findUnique({ where: { id } });
            if (!existing) {
                return {
                    statusCode: 404,
                    message: `Przedmiot nie został znaleziony`,
                };
            }

            if (existing.url) {
                const key = this.extractKeyFromUrl(existing.url);
                if (key) {
                    try {
                        await this.storageService.deleteFile(key);
                    } catch (err) {
                        console.error('Nie udało się usunąć Url przedmiotu:', err);
                    }
                }
            }

            await this.prismaService.subject.delete({ where: { id } });

            return {
                statusCode: 200,
                message: 'Przedmiot został pomyślnie usunięty',
            };
        }
        catch (error) {
            console.error(`Nie udało się usunąć przedmiot:`, error);
            throw new InternalServerErrorException('Błąd podczas usuwania przedmiotu');
        }
    }

    async uploadFileSubject(
        id: number,
        file?: File,
        url?: string,
    ) {
        try {
            const subject = await this.prismaService.subject.findUnique({ where: { id } });
            if (!subject) {
                return {
                    statusCode: 404,
                    message: 'Przedmiot nie został znaleziony',
                    public_url: '',
                };
            }

            if (subject.url) {
                const oldKey = this.extractKeyFromUrl(subject.url);
                if (oldKey) {
                    try {
                        await this.storageService.deleteFile(oldKey);
                    } catch (err) {
                        console.error('Nie udało się usunąć stary plik z S3:', err);
                    }
                }
            }

            let publicUrl: string;

            if (file) {
                const timestamp = Date.now();
                const extension = path.extname(file.originalname) || '.jpg';
                const fileKey = `subject_${id}_${timestamp}${extension}`;

                publicUrl = await this.storageService.uploadFile(file, fileKey);
            } else if (url) {
                const response = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer' });
                const contentType = response.headers['content-type'];
                if (!contentType || !contentType.startsWith('image/')) {
                    throw new BadRequestException('Invalid file type from URL. Only images are allowed.');
                }

                const timestamp = Date.now();
                const fileExtension = path.extname(new URL(url).pathname) || '.jpg';
                const fileKey = `subject_${id}_${timestamp}${fileExtension}`;

                publicUrl = await this.storageService.uploadBuffer(
                    Buffer.from(response.data),
                    fileKey,
                    contentType,
                );
            } else {
                throw new BadRequestException('Either file or url must be provided');
            }

            await this.prismaService.subject.update({
                where: { id },
                data: { url: publicUrl },
            });

            return {
                statusCode: 200,
                message: 'Plik został pomyślnie załadowany i URL zaktualizowany',
                public_url: publicUrl,
            };
        } catch (error) {
            console.error('Błąd podczas uploadu pliku:', error);
            throw new InternalServerErrorException('Błąd podczas uploadu pliku');
        }
    }

    async findTopics(
        subjectId: number,
        withSubject = true,
        withSections = true,
        withSubtopics = true,
        notStories = true,
        minSectionPart = 0
    ) {
        try {
            const response: any = {
                statusCode: 200,
                message: 'Pobrano listę tematów pomyślnie',
            };

            const subject = await this.prismaService.subject.findUnique({
                where: { id: subjectId },
            });

            if (!subject) {
                throw new BadRequestException('Przedmiot nie został znaleziony');
            }

            if (withSubject) {
                response.subject = subject;
            }

            const sectionWhere: any = {
                subjectId,
                partId: { gte: minSectionPart },
            };

            if (notStories === true) {
                sectionWhere.type = { not: 'Stories' };
            } else if (notStories === false) {
                sectionWhere.type = 'Stories';
            }

            const sections = await this.prismaService.section.findMany({
                where: sectionWhere,
                orderBy: { partId: 'asc' },
            });

            const sectionSubtopicsPromptMap = new Map<number, string>();
            const sectionSubtopicsStatusPromptMap = new Map<number, string>();
            const sectionTopicExpansionPromptMap = new Map<number, string>();
            const sectionWordsPromptMap = new Map<number, string>();
            const sectionPartIdMap = new Map<number, number>();

            for (const section of sections) {
                const resolvedSubtopicsPrompt =
                    !section.subtopicsPrompt || section.subtopicsPrompt.trim() === ''
                        ? subject.subtopicsPrompt ?? null
                        : section.subtopicsPrompt;

                const resolvedSubtopicsStatusPrompt =
                    !section.subtopicsStatusPrompt || section.subtopicsStatusPrompt.trim() === ''
                        ? subject.subtopicsStatusPrompt ?? null
                        : section.subtopicsStatusPrompt;

                const resolvedTopicExpansionPrompt =
                    !section.topicExpansionPrompt || section.topicExpansionPrompt.trim() === ''
                        ? subject.topicExpansionPrompt ?? null
                        : section.topicExpansionPrompt;

                const resolvedWordsPrompt =
                    !section.wordsPrompt || section.wordsPrompt.trim() === ''
                        ? subject.wordsPrompt ?? null
                        : section.wordsPrompt;

                sectionSubtopicsPromptMap.set(section.id, resolvedSubtopicsPrompt);
                sectionSubtopicsStatusPromptMap.set(section.id, resolvedSubtopicsStatusPrompt);
                sectionTopicExpansionPromptMap.set(section.id, resolvedTopicExpansionPrompt);
                sectionWordsPromptMap.set(section.id, resolvedWordsPrompt);
                sectionPartIdMap.set(section.id, section.partId);
            }

            const topicWhere: any = {
                section: {
                    subjectId,
                    partId: { gte: minSectionPart },
                },
            };

            if (notStories === true) {
                topicWhere.section.type = { not: 'Stories' };
            } else if (notStories === false) {
                topicWhere.section.type = 'Stories';
            }

            const topics = await this.prismaService.topic.findMany({
                where: topicWhere,
                include: {
                    section: withSections,
                    subtopics: withSubtopics,
                },
                orderBy: { partId: 'asc' },
            });

            const resolvedTopics = topics
                .map(topic => {
                    const sectionId = topic.sectionId;
                    const subtopicsPrompt = sectionSubtopicsPromptMap.get(sectionId) ?? null;
                    const subtopicsStatusPrompt = sectionSubtopicsStatusPromptMap.get(sectionId) ?? null;
                    const topicExpansionPrompt = sectionTopicExpansionPromptMap.get(sectionId) ?? null;
                    const wordsPrompt = sectionWordsPromptMap.get(sectionId) ?? null;
                    const sectionPartId = sectionPartIdMap.get(sectionId) ?? 0;

                    const result = {
                        ...topic,
                        subtopicsPrompt,
                        subtopicsStatusPrompt,
                        topicExpansionPrompt,
                        wordsPrompt,
                        _sectionPartId: sectionPartId,
                    };

                    if (!withSections) {
                        delete (result as any).section;
                    }

                    if (!withSubtopics) {
                        delete (result as any).subtopics;
                    }

                    return result;
                })
                .sort((a, b) => {
                    if (a._sectionPartId !== b._sectionPartId) {
                        return a._sectionPartId - b._sectionPartId;
                    }
                    return a.partId - b.partId;
                });

            const finalTopics = resolvedTopics.map(({ _sectionPartId, ...rest }) => rest);

            response.topics = finalTopics;
            return response;
        } catch (error) {
            throw new InternalServerErrorException(`Nie udało się pobrać tematów: ${error.message}`);
        }
    }

    async deleteTask(
        userId: number,
        subjectId: number,
        id: number
    ) {
        try {
            const subject = await this.prismaService.subject.findUnique({
                where: { id: subjectId },
            });

            if (!subject) throw new BadRequestException('Przedmiot nie został znaleziony');

            const task = await this.prismaService.task.findUnique({
                where: { id, userId },
                include: {
                    audioFiles: true
                }
            });

            if (!task) {
                throw new BadRequestException('Zadanie nie zostało znalezione');
            }

            if (task.audioFiles && task.audioFiles.length > 0) {
                for (const audioFile of task.audioFiles) {
                    if (audioFile.url) {
                        try {
                            const audioKey = this.extractKeyFromUrl(audioFile.url);
                            if (audioKey) {
                                await this.storageService.deleteFile(audioKey);
                            }
                        } catch (deleteError) {
                            console.error(`Nie udało się usunąć pliku audio z S3 (ID: ${audioFile.id}):`, deleteError);
                        }
                    }
                }
            }

            await this.prismaService.task.delete({
                where: { id, userId }
            });

            await this.calculateSubtopicsPercent(userId, subjectId);

            return {
                statusCode: 200,
                message: 'Usuwanie zadania zostało udane',
            };
        }
        catch (error) {
            console.error('Błąd podczas usuwania zadania:', error);
            throw new InternalServerErrorException('Nie udało się usunąć zadanie');
        }
    }
}