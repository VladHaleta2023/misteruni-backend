import { HttpService } from '@nestjs/axios';
import {
    BadRequestException,
    HttpException,
    HttpStatus,
    Inject,
    Injectable,
    InternalServerErrorException
} from '@nestjs/common';
import { FASTAPI_URL } from 'src/constans';
import { SubjectService } from 'src/subject/subject.service';
import { firstValueFrom } from 'rxjs';
import * as FormData from 'form-data';
import { PrismaService } from 'src/prisma/prisma.service';
import { SubtopicService } from 'src/subtopic/subtopic.service';
import { StorageService } from 'src/storage/storage.service';
import { Prisma, PrismaClient } from '@prisma/client';

interface AudioTranscribeParams {
  subjectId: number;
  file: Express.Multer.File;
  part_id: number;
  language?: string;
}

interface AudioTranscribeResponse {
  part_id: number;
  transcription: string;
  language: string;
  language_probability: number;
  subject: string;
}

interface SplitIntoSentencesResponse {
    sentences: string[];
}

type Subtopic = {
  topicId: number;
  subjectId: number;
  sectionId: number;
  subtopics: [string, number][];
};

@Injectable()
export class OptionsService {
    constructor (
        private readonly prismaService: PrismaService,
        private readonly subtopicService: SubtopicService,
        private readonly subjectService: SubjectService,
        private readonly httpService: HttpService,
        private readonly storageService: StorageService,
        @Inject(FASTAPI_URL) private readonly fastAPIUrl: string,
    ) {}

    async audioTranscribePart(params: AudioTranscribeParams)
        : Promise<AudioTranscribeResponse & { statusCode: number; message: string }> {
        const url = `${this.fastAPIUrl}/admin/audio-transcribe-part`;
        const { subjectId, file, part_id, language } = params;

        try {
            const subject = (await this.subjectService.findSubjectById(subjectId)).subject?.name || subjectId;
            const form = new FormData();

            form.append('file', file.buffer, {
                filename: file.originalname,
                contentType: file.mimetype,
                knownLength: file.size,
            });

            form.append('part_id', String(part_id));
            if (subject !== undefined) {
                form.append('subject', String(subject));
            }

            if (language !== undefined) {
                form.append('language', String(language));
            }

            const response$ = this.httpService.post(url, form);
            const response = await firstValueFrom(response$);

            if (!response.data ||
                !response.data.part_id ||
                !response.data.transcription ||
                !response.data.language ||
                !response.data.language_probability ||
                !response.data.subject) {
                throw new BadRequestException('Niepoprawna struktura odpowiedzi z serwera.');
            }

            return {
                statusCode: 201,
                message: "Transkrypcja audio udana pomyślnie",
                part_id: response.data.part_id,
                transcription: response.data.transcription,
                language: response.data.language,
                language_probability: response.data.language_probability,
                subject: response.data.subject
            };
        }
        catch (error) {
            if (error.response && error.response.data) {
                throw new BadRequestException(`Błąd API: ${JSON.stringify(error.response.data)}`);
            }
            throw new InternalServerErrorException(`Błąd serwisu transcribe: ${error.message || error.toString()}`);
        }
    }

    async textSplitIntoSentences(text: string, language: string = "ru")
        : Promise<SplitIntoSentencesResponse & { statusCode: number; message: string }> {
        try {
            const url = `${this.fastAPIUrl}/admin/split-into-sentences`;
            
            const response$ = this.httpService.post(url, { text, language });
            const response = await firstValueFrom(response$);

            if (!response.data ||
                !response.data.sentences) {
                throw new BadRequestException('Niepoprawna struktura odpowiedzi z serwera.');
            }

            return {
                statusCode: 201,
                message: "Podział tekstu na zdania udane",
                sentences: response.data.sentences
            };
        }
        catch (error) {
            if (error.response && error.response.data) {
                throw new BadRequestException(`Błąd API: ${JSON.stringify(error.response.data)}`);
            }
            throw new InternalServerErrorException(`Błąd serwisu transcribe: ${error.message || error.toString()}`);
        }
    }

    async createSubtopicsTransaction(
        subtopics: Subtopic[]
    ) {
        try {
            return await this.prismaService.$transaction(async (prismaClient) => {
                for (const subtopic of subtopics) {
                    await this.subtopicService.deleteSubtopics(
                        subtopic.subjectId,
                        subtopic.sectionId,
                        subtopic.topicId,
                        prismaClient
                    );

                    await this.subtopicService.createSubtopics(
                        subtopic.subjectId,
                        subtopic.sectionId,
                        subtopic.topicId,
                        subtopic.subtopics,
                        prismaClient
                    );
                }

                return {
                    statusCode: 201,
                    message: 'Podtematy zostały dodane',
                }
            }, {
                timeout: 900000,
            });
        } catch (error) {
            throw new InternalServerErrorException(`Nie udało się zapisać podtematów: ${error}`);
        }
    }

    async generateTTS(
        id: number,
        text: string,
        partId: number,
        language: string = "ru",
        prismaClient?: PrismaClient | Prisma.TransactionClient
    ) {
        try {
            prismaClient = prismaClient || this.prismaService;

            const url = `${this.fastAPIUrl}/admin/tts`;
            const task = await prismaClient.task.findUnique({ where: { id } });

            if (!task) {
                throw new HttpException('Zadanie nie zostało znalezione', HttpStatus.NOT_FOUND);
            }

            const payload = {
                id,
                part_id: partId,
                language,
                text,
            };

            const response$ = this.httpService.post(url, payload);
            const response = await firstValueFrom(response$);

            if (!response.data || !response.data.url) {
                throw new BadRequestException('Brak pola "url" w odpowiedzi z serwera');
            }

            const audioUrl = response.data.url;

            const audioFile = await prismaClient.audioFile.create({
                data: {
                    url: audioUrl,
                    order: partId,
                    taskId: id,
                },
            });

            return {
                statusCode: 201,
                message: 'Plik audio został pomyślnie wygenerowany',
                audioFile
            };
        }
        catch (error) {
            console.error('Nie udało się stworzyć audioplik:', error);
            throw new HttpException('Błąd podczas stworzenia audiopliku', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async deleteAudioFileByTaskId(
        id: number,
        prismaClient?: PrismaClient | Prisma.TransactionClient
    ) {
        try {
            prismaClient = prismaClient || this.prismaService;

            const task = await prismaClient.task.findUnique({ where: { id } });

            if (!task) {
                throw new HttpException('Zadanie nie zostało znalezione', HttpStatus.NOT_FOUND);
            }

            const files = await prismaClient.audioFile.findMany({
                where: { taskId: id },
            });

            for (const file of files) {
                const key = file.url.split('.amazonaws.com/')[1];
                await this.storageService.deleteFile(key);
            }

            await prismaClient.audioFile.deleteMany({
                where: { taskId: id }
            });

            return {
                statusCode: 200,
                message: 'Pliki zostały pomyślnie usunięte'
            };
        }
        catch (error) {
            throw new InternalServerErrorException('Błąd podczas usuwania plików');
        }
    }

    async resetAnswer() {
        await this.prismaService.task.update({
            where: { id: 97 },
            data: {
                answered: false,
                finished: false
            }
        })
    }
}
