import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SubjectCreateRequest, SubjectUpdateRequest } from './dto/subject-request.dto';
import { HttpService } from '@nestjs/axios';
import { FASTAPI_URL } from 'src/constans';
import { firstValueFrom } from 'rxjs';
import { StorageService } from 'src/storage/storage.service';
import axios from "axios";
import * as path from 'path';

type Status = 'blocked' | 'started' | 'progress' | 'completed';

@Injectable()
export class SubjectService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly httpService: HttpService,
        @Inject(FASTAPI_URL) private readonly fastAPIUrl: string,
        private readonly storageService: StorageService
    ) {}

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
        const url = `${this.fastAPIUrl}/admin/full-plan-generate`;

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
    
    async findSubjects(
        withSections: boolean = true
    ) {
        try {
            const subjects = await this.prismaService.subject.findMany({
                orderBy: { createdAt: 'asc' },
                include: {
                    ...(withSections && {
                        sections: {
                            orderBy: { partId: 'asc' },
                            include: {
                                topics: {
                                    orderBy: { partId: 'asc' },
                                },
                            },
                        },
                    }),
                },
            });

            return {
                statusCode: 200,
                message: 'Pobrano listę przedmiotów pomyślnie',
                subjects,
            };
        } catch (error) {
            console.error('Nie udało się pobrać przedmiotów:', error);
            throw new BadRequestException('Nie udało się pobrać przedmiotów');
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
                    questionPromptOwn: true,
                    solutionPromptOwn: true,
                    answersPromptOwn: true,
                    closedSubtopicsPromptOwn: true,
                    subQuestionsPromptOwn: true,
                    vocabluaryPromptOwn: true
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
        file?: Express.Multer.File,
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

            const sections = await this.prismaService.section.findMany({
                where: { subjectId },
            });

            const sectionPromptMap = new Map<number, string>();
            const sectionPartIdMap = new Map<number, number>();

            for (const section of sections) {
                const resolvedPrompt =
                    !section.subtopicsPrompt || section.subtopicsPrompt.trim() === ''
                        ? subject.subtopicsPrompt ?? null
                        : section.subtopicsPrompt;

                sectionPromptMap.set(section.id, resolvedPrompt);
                sectionPartIdMap.set(section.id, section.partId);
            }

            const topics = await this.prismaService.topic.findMany({
                where: {
                    section: { subjectId },
                },
                include: {
                    section: withSections,
                    subtopics: withSubtopics,
                },
            });

            const resolvedTopics = topics
                .map(topic => {
                    const sectionId = topic.sectionId;
                    const subtopicsPrompt = sectionPromptMap.get(sectionId) ?? null;
                    const sectionPartId = sectionPartIdMap.get(sectionId) ?? 0;

                    const result = {
                        ...topic,
                        subtopicsPrompt,
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
            throw new InternalServerErrorException(`Nie udało się pobrać tematów: ${error}`);
        }
    }

    async findTasks(id: number) {
        try {
            const subject = await this.prismaService.subject.findUnique({
                where: { id },
            });

            if (!subject) throw new BadRequestException('Przedmiot nie został znaleziony');

            const tasks = await this.prismaService.task.findMany({
                where: {
                    topic: {
                        subjectId: id,
                    },
                    parentTaskId: null,
                },
                include: {
                    topic: {
                        select: {
                            id: true,
                            name: true,
                            partId: true,
                            section: {
                                select: {
                                    id: true,
                                    name: true,
                                    type: true,
                                    partId: true,
                                },
                            },
                        },
                    },
                },
                orderBy: [
                    { updatedAt: 'desc' },
                    { order: 'asc' },
                    { topic: { partId: 'asc' } },
                    { topic: { section: { partId: 'asc' } } },
                ],
            });

            const tasksWithPercent = await Promise.all(
                tasks.map(async task => {
                    let status: Status = "started";

                    if (task.percent === 0) {
                        status = 'started';
                    } else if (task.percent < subject.threshold) {
                        status = 'progress';
                    } else {
                        status = 'completed';
                    }

                    return {
                        ...task,
                        status,
                        topic: {
                            id: task.topic.id,
                            name: task.topic.name,
                            partId: task.topic.partId,
                        },
                        section: {
                            id: task.topic.section.id,
                            name: task.topic.section.name,
                            partId: task.topic.section.partId,
                            type: task.topic.section.type,
                        },
                    };
                }),
            );

            const groupedTasksMap: Record<string, typeof tasksWithPercent> = {};
            tasksWithPercent.forEach(task => {
            const updated = task.updatedAt;
            const day = String(updated.getDate()).padStart(2, '0');
            const month = String(updated.getMonth() + 1).padStart(2, '0');
            const year = updated.getFullYear();
            const dateKey = `${day}-${month}-${year}`;

            if (!groupedTasksMap[dateKey]) groupedTasksMap[dateKey] = [];
                groupedTasksMap[dateKey].push(task);
            });

            const groupedTasks = Object.entries(groupedTasksMap).map(([dateKey, tasks]) => {
            const [day, month, year] = dateKey.split('-');
                return {
                    date: { day, month, year },
                    tasks,
                };
            });

            return {
                statusCode: 200,
                message: 'Pobrano listę zadań pomyślnie',
                elements: groupedTasks,
            };
        }
        catch (error) {
            throw new InternalServerErrorException('Nie udało się pobrać listę zadań');
        }
    }
}