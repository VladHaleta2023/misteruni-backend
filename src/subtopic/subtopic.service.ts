import { BadRequestException, Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SubtopicCreateRequest } from 'src/subtopic/dto/subtopic-request.dto';
import { SubtopicsAIGenerate } from './dto/subtopics-generate.dto';
import { HttpService } from '@nestjs/axios';
import { FASTAPI_URL } from './constans';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SubtopicService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly httpService: HttpService,
        @Inject(FASTAPI_URL) private readonly fastAPIUrl: string,
    ) {}

    async findAllSubtopics(
        subjectId: number,
        sectionId: number,
        topicId: number
    ) {
        try {
            const subject = await this.prismaService.subject.findUnique({
                where: { id: subjectId },
            });

            if (!subject) {
                throw new BadRequestException('Przedmiot nie został znaleziony');
            }

            const section = await this.prismaService.section.findUnique({
                where: { id: sectionId },
            });

            if (!section) {
                throw new BadRequestException('Dział nie został znaleziony');
            }

            const topic = await this.prismaService.topic.findUnique({
                where: { id: topicId },
            });

            if (!topic) {
                throw new BadRequestException('Temat nie został znaleziony');
            }

            const subtopics = await this.prismaService.subtopic.findMany({
                where: {
                    subjectId,
                    sectionId,
                    topicId
                },
                orderBy: {
                    name: 'asc'
                }
            });

            return {
                statusCode: 200,
                message: 'Pobrano listę podtematów pomyślnie',
                subtopics
            }
        }
        catch (error) {
            console.error('Nie udało się pobrać podtematów:', error);
            throw new InternalServerErrorException('Nie udało się pobrać podtematów');
        }
    }

    async findSubtopicById(
        subjectId: number,
        sectionId: number,
        topicId: number,
        id: number
    ) {
        try {
            const subject = await this.prismaService.subject.findUnique({
                where: { id: subjectId },
            });

            if (!subject) {
                throw new BadRequestException('Przedmiot nie został znaleziony');
            }

            const section = await this.prismaService.section.findUnique({
                where: { id: sectionId },
            });

            if (!section) {
                throw new BadRequestException('Dział nie został znaleziony');
            }

            const topic = await this.prismaService.topic.findUnique({
                where: { id: topicId },
            });

            if (!topic) {
                throw new BadRequestException('Temat nie został znaleziony');
            }

            const subtopic = await this.prismaService.subtopic.findUnique({
                where: { id }
            });

            if (!subtopic) {
                throw new BadRequestException('Podtemat nie został znaleziony');
            }

            return {
                statusCode: 200,
                message: 'Pobrano podtemat pomyślnie',
                subtopic
            }
        }
        catch (error) {
            console.error('Nie udało się pobrać podtemat:', error);
            throw new InternalServerErrorException('Nie udało się pobrać podtemat');
        }
    }

    async createSubtopic(
        subjectId: number,
        sectionId: number,
        topicId: number,
        data: SubtopicCreateRequest
    ) {
        try {
            const subject = await this.prismaService.subject.findUnique({
                where: { id: subjectId },
            });

            if (!subject) {
                throw new BadRequestException('Przedmiot nie został znaleziony');
            }

            const section = await this.prismaService.section.findUnique({
                where: { id: sectionId },
            });

            if (!section) {
                throw new BadRequestException('Dział nie został znaleziony');
            }

            const topic = await this.prismaService.topic.findUnique({
                where: { id: topicId },
            });

            if (!topic) {
                throw new BadRequestException('Temat nie został znaleziony');
            }

            const newSubtopic = await this.prismaService.subtopic.create({
                data: {
                    subjectId,
                    sectionId,
                    topicId,
                    name: data.name,
                }
            });

            return {
                statusCode: 201,
                message: 'Podtemat został dodany pomyślnie',
                subtopic: newSubtopic,
            }
        }
        catch (error) {
            console.error('Błąd dodawania podtematu:', error);
            throw new InternalServerErrorException('Błąd dodawania podtematu');
        }
    }

    async createSubtopics(
        subjectId: number,
        sectionId: number,
        topicId: number,
        subtopics: string[]
    ) {
        try {
            const subject = await this.prismaService.subject.findUnique({
                where: { id: subjectId },
            });

            if (!subject) {
                throw new BadRequestException('Przedmiot nie został znaleziony');
            }

            const section = await this.prismaService.section.findUnique({
                where: { id: sectionId },
            });

            if (!section) {
                throw new BadRequestException('Dział nie został znaleziony');
            }

            const topic = await this.prismaService.topic.findUnique({
                where: { id: topicId },
            });

            if (!topic) {
                throw new BadRequestException('Temat nie został znaleziony');
            }

            const formatted = subtopics.map((sub) => ({
                name: sub,
                topicId: topicId,
                sectionId: sectionId,
                subjectId: subjectId,
            }));

            await this.prismaService.subtopic.createMany({
                data: formatted,
                skipDuplicates: true,
            });


            return {
                statusCode: 201,
                message: 'Podtematy zostały dodane',
            }
        }
        catch (error) {
            console.error('Błąd dodawania podtematu:', error);
            throw new InternalServerErrorException('Błąd dodawania podtematu');
        }
    }

    async deleteSubtopic(
        subjectId: number,
        sectionId: number,
        topicId: number,
        id: number
    ) {
        try {
            const subject = await this.prismaService.subject.findUnique({
                where: { id: subjectId },
            });

            if (!subject) {
                throw new BadRequestException('Przedmiot nie został znaleziony');
            }

            const section = await this.prismaService.section.findUnique({
                where: { id: sectionId },
            });

            if (!section) {
                throw new BadRequestException('Dział nie został znaleziony');
            }

            const topic = await this.prismaService.topic.findUnique({
                where: { id: topicId },
            });

            if (!topic) {
                throw new BadRequestException('Temat nie został znaleziony');
            }

            const subtopic = await this.prismaService.subtopic.findUnique({
                where: { id }
            });

            if (!subtopic) {
                throw new BadRequestException('Podtemat nie został znaleziony');
            }

            await this.prismaService.subtopic.delete({
                where: { id }
            });

            return {
                statusCode: 200,
                message: 'Podtemat został pomyślnie usunięty',
            };
        }
        catch (error) {
            console.error('Błąd usuwania podtematu:', error);
            throw new InternalServerErrorException('Błąd usuwania podtematu');
        }
    }

    async deleteSubtopics(
        subjectId: number,
        sectionId: number,
        topicId: number
    ) {
        try {
            const subject = await this.prismaService.subject.findUnique({
                where: { id: subjectId },
            });

            if (!subject) {
                throw new BadRequestException('Przedmiot nie został znaleziony');
            }

            const section = await this.prismaService.section.findUnique({
                where: { id: sectionId },
            });

            if (!section) {
                throw new BadRequestException('Dział nie został znaleziony');
            }

            const topic = await this.prismaService.topic.findUnique({
                where: { id: topicId },
            });

            if (!topic) {
                throw new BadRequestException('Temat nie został znaleziony');
            }

            await this.prismaService.subtopic.deleteMany({
                where: {
                    subjectId,
                    sectionId,
                    topicId
                }
            });

            return {
                statusCode: 200,
                message: 'Podtematy zostały pomyślnie usunięte',
            };
        }
        catch (error) {
            console.error('Błąd usuwania podtematów:', error);
            throw new InternalServerErrorException('Błąd usuwania podtematów');
        }
    }

    async subtopicsAIGenerate(
        subjectId: number,
        sectionId: number,
        topicId: number,
        data: SubtopicsAIGenerate
    ) {
        const url = `${this.fastAPIUrl}/admin/subtopics-generate`;

        try {
            const subject = await this.prismaService.subject.findUnique({
                where: { id: subjectId },
            });

            if (!subject) {
                throw new BadRequestException('Przedmiot nie został znaleziony');
            }

            const section = await this.prismaService.section.findUnique({
                where: { id: sectionId },
            });

            if (!section) {
                throw new BadRequestException('Dział nie został znaleziony');
            }

            const topic = await this.prismaService.topic.findUnique({
                where: { id: topicId },
            });

            if (!topic) {
                throw new BadRequestException('Temat nie został znaleziony');
            }

            data.subject = subject.name;
            data.section = section.name;
            data.topic = topic.name;

            const response$ = this.httpService.post(url, data);
            const response = await firstValueFrom(response$);
            const r = response.data;

            if (
                !r?.prompt ||
                !r?.changed ||
                !r?.subject ||
                !r?.section ||
                !r?.topic ||
                !Array.isArray(r.subtopics) ||
                typeof r.attempt !== 'number'
            ) {
                throw new BadRequestException('Niepoprawna struktura odpowiedzi z serwera.');
            }

            return {
                statusCode: 201,
                message: "Generacja podtematów udana",
                ...r
            };
        }
        catch (error) {
            if (error.response && error.response.data) {
                throw new BadRequestException(`Błąd API: ${JSON.stringify(error.response.data)}`);
            }
            throw new InternalServerErrorException(`Błąd serwisu generującego: ${error.message || error.toString()}`);
        }
    }
}
