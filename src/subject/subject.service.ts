import { BadRequestException, Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SubjectCreateRequest, SubjectUpdateRequest } from './dto/subject-request.dto';
import { HttpService } from '@nestjs/axios';
import { FASTAPI_URL } from './constans';
import { firstValueFrom } from 'rxjs';
import { StorageService } from 'src/storage/storage.service';
import axios from "axios";
import * as path from 'path';

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

    async updateSubjectPrompt(id: number, prompt: string) {
        try {
            const existing = await this.prismaService.subject.findUnique({ where: { id } });
            if (!existing) {
                return {
                    statusCode: 404,
                    message: `Przedmiot nie został znaleziony`,
                };
            }

            const updateData: { prompt: string } = {
                prompt: prompt,
            };

            if (prompt === undefined || prompt === null || prompt.trim() === '') {
                console.error(`Prompt jest pusty, nie aktualizuję.`);
                return;
            }

            await this.prismaService.subject.update({
                where: { id },
                data: updateData,
            });
        }
        catch (error) {
            console.error(`Nie udało się zaktualizować prompt przedmiotu:`, error);
        }
    }

    async subjectAIPlanGenerate(id: number, prompt: string) {
        const url = `${this.fastAPIUrl}/admin/full-plan-generate`;

        try {
            await this.updateSubjectPrompt(id, prompt);

            const response$ = this.httpService.post(url, { prompt });
            const response = await firstValueFrom(response$);

            if (!response.data || !response.data.sections) {
                throw new BadRequestException('Niepoprawna struktura odpowiedzi z serwera.');
            }

            await this.deleteAllSectionsBySubjectId(id);

            for (let i = 0; i < response.data.sections.length; i++) {
                const section = response.data.sections[i];

                const createdSection = await this.prismaService.section.create({
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

                    await this.prismaService.topic.createMany({
                        data: topicsData,
                    });
                }
            }

            return {
                statusCode: 201,
                message: "Generacja treści przedmiotu udana",
                sections: response.data.sections
            };
        }
        catch (error) {
            if (error.response && error.response.data) {
                throw new BadRequestException(`Błąd API: ${JSON.stringify(error.response.data)}`);
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
                subject,
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

            const updateData: Partial<{
                name: string;
                prompt: string;
                type: string;
                subtopicsPrompt: string;
                subtopicsRefinePrompt: string;
                subtopicsCriterions: string;
            }> = {};

            if (data.name !== undefined) {
                updateData.name = data.name;
            }

            if (data.type !== undefined) {
                updateData.type = data.type;
            }

            if (data.subtopicsPrompt !== undefined) {
                updateData.subtopicsPrompt = data.subtopicsPrompt;
            }

            if (data.subtopicsRefinePrompt !== undefined) {
                updateData.subtopicsRefinePrompt = data.subtopicsRefinePrompt;
            }

            if (data.prompt !== undefined) {
                updateData.prompt = data.prompt;
            }

            if (data.subtopicsCriterions !== undefined) {
                updateData.subtopicsCriterions = data.subtopicsCriterions;
            }

            const updatedSubject = await this.prismaService.subject.update({
                where: { id },
                data: updateData,
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
}