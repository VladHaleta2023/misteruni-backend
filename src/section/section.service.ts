import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SectionUpdateRequest } from './dto/section-request.dto';

@Injectable()
export class SectionService {
    constructor(private readonly prismaService: PrismaService) {}

    async findSections(
        subjectId: number,
        withSubject = false,
    ) {
        try {
            const subject = await this.prismaService.subject.findUnique({
                where: { id: subjectId },
            });

            if (!subject) {
                throw new BadRequestException('Przedmiot nie został znaleziony');
            }

            const sections = await this.prismaService.section.findMany({
                where: { subjectId },
                orderBy: { partId: 'asc' },
            });

            const response: any = {
                statusCode: 200,
                message: 'Dział został pomyślnie pobrany',
            };

            if (withSubject) {
                response.subject = subject;
            }

            const enrichedSections = sections.map((section) => {
                const resolvedSubtopicsPrompt =
                    section.subtopicsPrompt?.trim() === '' || !section.subtopicsPrompt
                        ? subject?.subtopicsPrompt ?? null
                        : section.subtopicsPrompt;

            const resolvedSubtopicsCriterions =
                !section.subtopicsCriterions || section.subtopicsCriterions.trim() === ''
                ? subject.subtopicsCriterions ?? null
                : section.subtopicsCriterions;

            const resolvedSubtopicsRefinePrompt =
                section.subtopicsRefinePrompt?.trim() === '' || !section.subtopicsRefinePrompt
                    ? subject?.subtopicsRefinePrompt ?? null
                    : section.subtopicsRefinePrompt;

            return {
                ...section,
                subtopicsPrompt: resolvedSubtopicsPrompt,
                subtopicsRefinePrompt: resolvedSubtopicsRefinePrompt,
                subtopicsCriterion: resolvedSubtopicsCriterions
            };
        });

            response.sections = enrichedSections;

            return response;
        }
        catch (error) {
            console.error('Nie udało się pobrać działów:', error);
            throw new InternalServerErrorException('Nie udało się pobrać działów');
        }
    }

    async findSectionById(
        subjectId: number,
        id: number,
        withSubject = true,
    ) {
        try {
            const subject = await this.prismaService.subject.findUnique({
                where: { id: subjectId },
            });

            if (!subject) {
                throw new BadRequestException('Przedmiot nie został znaleziony');
            }

            const section = await this.prismaService.section.findFirst({
                where: { subjectId, id },
            });

            if (!section) {
                throw new BadRequestException('Dział nie został znaleziony');
            }

            const resolvedSubtopicsPrompt =
                section.subtopicsPrompt?.trim() === '' || !section.subtopicsPrompt
                    ? subject?.subtopicsPrompt ?? null
                    : section.subtopicsPrompt;

            const resolvedSubtopicsCriterions =
                !section.subtopicsCriterions || section.subtopicsCriterions.trim() === ''
                ? subject.subtopicsCriterions ?? null
                : section.subtopicsCriterions;

            const resolvedSubtopicsRefinePrompt =
                section.subtopicsRefinePrompt?.trim() === '' || !section.subtopicsRefinePrompt
                    ? subject?.subtopicsRefinePrompt ?? null
                    : section.subtopicsRefinePrompt;

            const enrichedSection = {
                ...section,
                subtopicsPrompt: resolvedSubtopicsPrompt,
                subtopicsRefinePrompt: resolvedSubtopicsRefinePrompt,
                subtopicsCriterion: resolvedSubtopicsCriterions
            };

            const response: any = {
                statusCode: 200,
                message: 'Pobrano listę działów pomyślnie',
                section: enrichedSection,
            };

            if (withSubject) {
                response.subject = subject;
            }

            return response;
        } catch (error) {
            console.error('Nie udało się pobrać dział:', error);
            throw new InternalServerErrorException('Nie udało się pobrać dział');
        }
    }

    async updateSection(
        subjectId: number,
        id: number,
        data: SectionUpdateRequest
    ) {
        try {
            const existingSubject = await this.prismaService.subject.findUnique({ where: { id: subjectId } });
            if (!existingSubject) {
                return {
                    statusCode: 404,
                    message: `Przedmiot nie został znaleziony`,
                };
            }

            const existingSection = await this.prismaService.section.findUnique({ where: { id } });
            if (!existingSection) {
                return {
                    statusCode: 404,
                    message: `Dział nie został znaleziony`,
                };
            }

            const updateData: Partial<{
                name: string;
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

            if (data.subtopicsCriterions !== undefined) {
                updateData.subtopicsCriterions = data.subtopicsCriterions;
            }

            const updatedSection = await this.prismaService.section.update({
                where: { id },
                data: updateData,
            });

            return {
                statusCode: 200,
                message: 'Dział został pomyślnie zaktualizowany',
                subject: updatedSection,
            };
        }
        catch (error) {
            console.error(`Nie udało się zaktualizować dział:`, error);
            throw new InternalServerErrorException('Błąd podczas aktualizacji dział');
        }
    }
}