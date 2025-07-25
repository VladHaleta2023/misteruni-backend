import { HttpService } from '@nestjs/axios';
import {
    BadRequestException,
    HttpException,
    HttpStatus,
    Inject,
    Injectable,
    InternalServerErrorException
} from '@nestjs/common';
import { FASTAPI_URL } from './constans';
import { SubjectService } from 'src/subject/subject.service';
import { firstValueFrom } from 'rxjs';
import * as FormData from 'form-data';
import { PrismaService } from 'src/prisma/prisma.service';

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

@Injectable()
export class OptionsService {
    constructor (
        private readonly prismaService: PrismaService,
        private readonly subjectService: SubjectService,
        private readonly httpService: HttpService,
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

    async addTextOption(text: string) {
        try {
            const newText = await this.prismaService.text.create({
                data: {
                    text: text
                },
            });

            return {
                statusCode: 201,
                message: 'Tekst został pomyślnie dodany',
                text: newText,
            };
        }
        catch (error) {
            console.error(`Nie udało się dodać zadania:`, error);
            throw new InternalServerErrorException('Błąd podczas dodawania zadania');
        }
    }

    async updateTextOption(id: number, text: string) {
        try {
            const existing = await this.prismaService.text.findUnique({ where: { id } });

            if (!existing) {
                throw new HttpException('Tekst nie został znaleziony', HttpStatus.NOT_FOUND);
            }

            try {
                await this.prismaService.audioFile.deleteMany({
                    where: { textId: id },
                });
            } catch (error) {
                console.error('Nie udało się usunąć audiopliki:', error);
                throw new HttpException('Błąd podczas usuwania audioplików', HttpStatus.INTERNAL_SERVER_ERROR);
            }

            const updatedText = await this.prismaService.text.update({
                where: { id },
                data: { text },
            });

            return {
                statusCode: 200,
                message: 'Tekst został pomyślnie zaktualizowany',
                text: updatedText,
            };
        } catch (error) {
            console.error('Nie udało się zaktualizować tekstu:', error);
            throw new HttpException('Błąd podczas aktualizacji tekstu', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async generateTTS(id: number, text: string, part_id: number, language: string) {
        try {
            const url = `${this.fastAPIUrl}/admin/tts`;
            const existing = await this.prismaService.text.findUnique({ where: { id } });

            if (!existing) {
                throw new HttpException('Tekst nie został znaleziony', HttpStatus.NOT_FOUND);
            }

            const payload = {
                id,
                part_id,
                language,
                text,
            };

            const response$ = this.httpService.post(url, payload);
            const response = await firstValueFrom(response$);

            if (!response.data || !response.data.url) {
                throw new BadRequestException('Brak pola "url" w odpowiedzi z serwera');
            }

            const audioUrl = response.data.url;

            const audioFile = await this.prismaService.audioFile.create({
                data: {
                    url: audioUrl,
                    part_id,
                    textId: id,
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

    async findAllAudioFilesByTextId(textId: number) {
        try {
            const audioFiles = await this.prismaService.audioFile.findMany({
                where: {
                    textId
                },
                orderBy: {
                    part_id: "asc"
                }
            });

            return {
                statusCode: 200,
                message: `Pobranie wszystkich audioplików dla textId ${textId} udane`,
                audioFiles
            };
        }
        catch (error) {
            console.error(`Nie udało się pobrać wszystkie audiopliki dla textId ${textId}:`, error);
            throw new InternalServerErrorException(`Błąd podczas pobrania wszystkich audioplików dla textId ${textId}`);
        }
    }
}
