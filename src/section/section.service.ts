import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SectionUpdateRequest } from './dto/section-request.dto';

@Injectable()
export class SectionService {
    constructor(private readonly prismaService: PrismaService) {}

    async findSections(
        subjectId: number,
        withSubject = false,
        withTopics = false,
        withSubtopics = false,
        withPercent = false,
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

            const resolvePrompts = (section: any) => {
                return {
                    subtopicsPrompt:
                        section.subtopicsPrompt?.trim() === '' || !section.subtopicsPrompt
                            ? subject.subtopicsPrompt ?? null
                            : section.subtopicsPrompt,
                    questionPrompt:
                        section.questionPrompt?.trim() === '' || !section.questionPrompt
                            ? subject.questionPrompt ?? null
                            : section.questionPrompt,
                    solutionPrompt:
                        section.solutionPrompt?.trim() === '' || !section.solutionPrompt
                            ? subject.solutionPrompt ?? null
                            : section.solutionPrompt,
                    answersPrompt:
                        section.answersPrompt?.trim() === '' || !section.answersPrompt
                            ? subject.answersPrompt ?? null
                            : section.answersPrompt,
                };
            };

            const response: any = {
                statusCode: 200,
                message: 'Dział został pomyślnie pobrany',
            };

            if (withSubject) {
                response.subject = subject;
            }

            if (withTopics) {
                const topics = await this.prismaService.topic.findMany({
                    where: { subjectId },
                    orderBy: { partId: 'asc' },
                });

                let subtopicsGrouped: Record<number, any[]> = {};

                if (withSubtopics) {
                    const topicIds = topics.map(t => t.id);
                    const subtopics = await this.prismaService.subtopic.findMany({
                        where: { topicId: { in: topicIds } },
                        orderBy: { name: 'asc' },
                        select: withPercent
                            ? { id: true, topicId: true, name: true, percent: true }
                            : { id: true, topicId: true, name: true },
                    });

                    subtopicsGrouped = subtopics.reduce((acc, sub) => {
                        if (!acc[sub.topicId]) acc[sub.topicId] = [];
                        acc[sub.topicId].push(sub);
                        return acc;
                    }, {} as Record<number, any[]>);
                }

                const topicsWithPercent = topics.map(topic => {
                    const subtopicsForTopic = withSubtopics ? (subtopicsGrouped[topic.id] ?? []) : [];
                    let topicPercent: number | null = null;

                    if (withPercent && subtopicsForTopic.length > 0) {
                        const sum = subtopicsForTopic.reduce((acc, st) => acc + (st.percent ?? 0), 0);
                        topicPercent = sum / subtopicsForTopic.length;
                    } else if (withPercent) {
                        topicPercent = null;
                    }

                    return {
                        ...topic,
                        percent: topicPercent,
                        subtopics: withSubtopics ? subtopicsForTopic : undefined,
                    };
                });

                const topicsBySection = topicsWithPercent.reduce<Record<number, any[]>>((acc, topic) => {
                    const secId = topic.sectionId;
                    if (!acc[secId]) acc[secId] = [];
                    acc[secId].push(topic);
                    return acc;
                }, {});

                const enrichedSections = sections.map(section => {
                    const prompts = resolvePrompts(section);

                    const topicsForSection = topicsBySection[section.id] ?? [];
                    let sectionPercent: number | null = null;

                    if (withPercent && topicsForSection.length > 0) {
                        const sum = topicsForSection.reduce((acc, t) => acc + (t.percent ?? 0), 0);
                        sectionPercent = sum / topicsForSection.length;
                    } else if (withPercent) {
                        sectionPercent = null;
                    }

                    return {
                        ...section,
                        ...prompts,
                        percent: sectionPercent,
                        topics: topicsForSection,
                    };
                });

                response.sections = enrichedSections;
            } else {
                const enrichedSections = sections.map(section => {
                    const prompts = resolvePrompts(section);
                    return {
                        ...section,
                        ...prompts,
                        percent: withPercent ? null : undefined,
                    };
                });

                response.sections = enrichedSections;
            }

            return response;
        } catch (error) {
            console.error('Nie udało się pobrać działów:', error);
            throw new InternalServerErrorException('Nie udało się pobrać działów');
        }
    }

    async findSectionById(
        subjectId: number,
        id: number,
        withSubject = true,
        withTopics = false,
        withSubtopics = false,
        withPercent = false,
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

            const resolvedQuestionPrompt =
                section.questionPrompt?.trim() === '' || !section.questionPrompt
                    ? subject?.questionPrompt ?? null
                    : section.questionPrompt;

            const resolvedSolutionPrompt =
                section.solutionPrompt?.trim() === '' || !section.solutionPrompt
                    ? subject?.solutionPrompt ?? null
                    : section.solutionPrompt;

            const resolvedAnswersPrompt =
                section.answersPrompt?.trim() === '' || !section.answersPrompt
                    ? subject?.answersPrompt ?? null
                    : section.answersPrompt;

            let enrichedSection: any = {
                ...section,
                subtopicsPrompt: resolvedSubtopicsPrompt,
                questionPrompt: resolvedQuestionPrompt,
                solutionPrompt: resolvedSolutionPrompt,
                answersPrompt: resolvedAnswersPrompt,
            };

            if (withTopics) {
                const topics = await this.prismaService.topic.findMany({
                    where: { subjectId, sectionId: section.id },
                    orderBy: { partId: 'asc' },
                });

                let subtopicsGrouped: Record<number, any[]> = {};

                if (withSubtopics) {
                    const topicIds = topics.map(t => t.id);
                    const subtopics = await this.prismaService.subtopic.findMany({
                        where: { topicId: { in: topicIds } },
                        orderBy: { name: 'asc' },
                        select: withPercent
                            ? { id: true, topicId: true, name: true, percent: true }
                            : { id: true, topicId: true, name: true }
                    });

                    subtopicsGrouped = subtopics.reduce((acc, sub) => {
                        if (!acc[sub.topicId]) acc[sub.topicId] = [];
                        acc[sub.topicId].push(sub);
                        return acc;
                    }, {} as Record<number, any[]>);
                }

                const topicsWithPercent = topics.map(topic => {
                    const subtopicsForTopic = withSubtopics ? (subtopicsGrouped[topic.id] ?? []) : [];
                    let topicPercent: number | null = null;

                    if (withPercent && subtopicsForTopic.length > 0) {
                        const sum = subtopicsForTopic.reduce((acc, st) => acc + (st.percent ?? 0), 0);
                        topicPercent = sum / subtopicsForTopic.length;
                    } else if (withPercent) {
                        topicPercent = null;
                    }

                    return {
                        ...topic,
                        percent: topicPercent,
                        subtopics: withSubtopics ? subtopicsForTopic : undefined,
                    };
                });

                let sectionPercent: number | null = null;

                if (withPercent && topicsWithPercent.length > 0) {
                    const sum = topicsWithPercent.reduce((acc, t) => acc + (t.percent ?? 0), 0);
                    sectionPercent = sum / topicsWithPercent.length;
                }
                else if (withPercent) {
                    sectionPercent = null;
                }

                enrichedSection = {
                    ...enrichedSection,
                    percent: sectionPercent,
                    topics: topicsWithPercent,
                };
            }
            else {
                enrichedSection = {
                    ...enrichedSection,
                    percent: withPercent ? null : undefined,
                };
            }

            const response: any = {
                statusCode: 200,
                message: 'Pobrano listę działów pomyślnie',
                section: enrichedSection,
            };

            if (withSubject) {
                response.subject = subject;
            }

            return response;
        }
        catch (error) {
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

            const updatedSection = await this.prismaService.section.update({
                where: { id },
                data,
            });

            return {
                statusCode: 200,
                message: 'Dział został pomyślnie zaktualizowany',
                section: updatedSection,
            };
        }
        catch (error) {
            console.error(`Nie udało się zaktualizować dział:`, error);
            throw new InternalServerErrorException('Błąd podczas aktualizacji dział');
        }
    }
}