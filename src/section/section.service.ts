import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { SectionUpdateRequest } from './dto/section-request.dto';

type Status = 'blocked' | 'started' | 'progress' | 'completed';

interface Subtopic extends Record<string, any> {
    blocked: boolean;
    percent: number;
    status?: Status;
}

interface Topic extends Record<string, any> {
    blocked: boolean;
    subtopics: Subtopic[];
    status?: Status;
}

interface Section extends Record<string, any> {
    blocked: boolean;
    topics: Topic[];
    status?: Status;
}

@Injectable()
export class SectionService {
    constructor(private readonly prismaService: PrismaService) {}

    addStatusToSections(sections: Section[], threshold: number): Section[] {
        return sections.map(section => {
            const updatedTopics = section.topics.map(topic => {
                if (topic.subtopics && topic.subtopics.length > 0) {
                    const updatedSubtopics = topic.subtopics.map(subtopic => {
                        let status: Status;

                        if (subtopic.blocked === true) {
                            status = 'blocked';
                        } else if (subtopic.percent === 0) {
                            status = 'started';
                        } else if (subtopic.percent < threshold) {
                            status = 'progress';
                        } else {
                            status = 'completed';
                        }

                        return { ...subtopic, status };
                    });

                    const activeSubtopics = updatedSubtopics.filter(st => st.status !== 'blocked');

                    const allStarted = activeSubtopics.every(st => st.status === 'started');
                    const allCompleted = activeSubtopics.every(st => st.status === 'completed');
                    const anyStarted = activeSubtopics.some(st => st.status === 'started');
                    const anyProgress = activeSubtopics.some(st => st.status === 'progress');
                    const anyCompleted = activeSubtopics.some(st => st.status === 'completed');

                    let topicStatus: Status;

                    if (topic.blocked === true || activeSubtopics.length === 0) {
                        topicStatus = 'blocked';
                    } else if (allStarted) {
                        topicStatus = 'started';
                    } else if (anyProgress) {
                        topicStatus = 'progress';
                    } else if (anyStarted && anyCompleted) {
                        topicStatus = 'progress';
                    } else if (allCompleted) {
                        topicStatus = 'completed';
                    } else {
                        topicStatus = 'started';
                    }

                    return { ...topic, subtopics: updatedSubtopics, status: topicStatus };
                } else {
                    const percent = topic.percent ?? 0;
                    let topicStatus: Status;

                    if (topic.blocked === true) {
                        topicStatus = 'blocked';
                    } else if (percent === 0) {
                        topicStatus = 'started';
                    } else if (percent < threshold) {
                        topicStatus = 'progress';
                    } else {
                        topicStatus = 'completed';
                    }

                    return { ...topic, status: topicStatus };
                }
            });

            const activeTopics = updatedTopics.filter(t => t.status !== 'blocked');

            const allStarted = activeTopics.every(t => t.status === 'started');
            const allCompleted = activeTopics.every(t => t.status === 'completed');
            const anyStarted = activeTopics.some(t => t.status === 'started');
            const anyProgress = activeTopics.some(t => t.status === 'progress');
            const anyCompleted = activeTopics.some(t => t.status === 'completed');

            let sectionStatus: Status;

            if (section.blocked === true || activeTopics.length === 0) {
                sectionStatus = 'blocked';
            } else if (allStarted) {
                sectionStatus = 'started';
            } else if (anyProgress) {
                sectionStatus = 'progress';
            } else if (anyStarted && anyCompleted) {
                sectionStatus = 'progress';
            } else if (allCompleted) {
                sectionStatus = 'completed';
            } else {
                sectionStatus = 'started';
            }

            return { ...section, topics: updatedTopics, status: sectionStatus };
        });
    }

    async findSections(
        subjectId: number,
        withSubject = false,
        withTopics = false,
        withSubtopics = false,
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
                const subtopicsPromptOwn = Boolean(section.subtopicsPrompt && section.subtopicsPrompt.trim() !== "");
                const questionPromptOwn = Boolean(section.questionPrompt && section.questionPrompt.trim() !== "");
                const solutionPromptOwn = Boolean(section.solutionPrompt && section.solutionPrompt.trim() !== "");
                const answersPromptOwn = Boolean(section.answersPrompt && section.answersPrompt.trim() !== "");
                const closedSubtopicsPromptOwn = Boolean(section.closedSubtopicsPrompt && section.closedSubtopicsPrompt.trim() !== "");

                return {
                    subtopicsPrompt: subtopicsPromptOwn ? section.subtopicsPrompt.trim() : (subject.subtopicsPrompt || ""),
                    subtopicsPromptOwn: subtopicsPromptOwn,

                    questionPrompt: questionPromptOwn ? section.questionPrompt.trim() : (subject.questionPrompt || ""),
                    questionPromptOwn: questionPromptOwn,

                    solutionPrompt: solutionPromptOwn ? section.solutionPrompt.trim() : (subject.solutionPrompt || ""),
                    solutionPromptOwn: solutionPromptOwn,

                    answersPrompt: answersPromptOwn ? section.answersPrompt.trim() : (subject.answersPrompt || ""),
                    answersPromptOwn: answersPromptOwn,

                    closedSubtopicsPrompt: closedSubtopicsPromptOwn ? section.closedSubtopicsPrompt.trim() : (subject.closedSubtopicsPrompt || ""),
                    closedSubtopicsPromptOwn: closedSubtopicsPromptOwn,
                };
            };

            const response: any = {
                statusCode: 200,
                message: 'Działy zostały pomyślnie pobrane',
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
                        select: {
                            id: true,
                            topicId: true,
                            name: true,
                            percent: true,
                            blocked: true,
                        },
                    });

                    subtopicsGrouped = subtopics.reduce((acc, sub) => {
                        if (!acc[sub.topicId]) acc[sub.topicId] = [];
                        acc[sub.topicId].push(sub);
                        return acc;
                    }, {} as Record<number, any[]>);
                }

                const topicsWithPercent = topics.map(topic => {
                    const subtopics = withSubtopics ? subtopicsGrouped[topic.id] || [] : [];
                    const validSubtopics = subtopics.filter(s => !s.blocked);
                    const percent =
                        validSubtopics.length > 0
                            ? validSubtopics.reduce((acc, s) => acc + (s.percent ?? 0), 0) / validSubtopics.length
                            : 0;

                    return {
                        ...topic,
                        percent,
                        subtopics,
                    };
                });

                const topicsBySection = topicsWithPercent.reduce<Record<number, any[]>>((acc, topic) => {
                    const sectionId = topic.sectionId;
                    if (!acc[sectionId]) acc[sectionId] = [];
                    acc[sectionId].push(topic);
                    return acc;
                }, {});

                const enrichedSections = sections.map(section => {
                    const prompts = resolvePrompts(section);
                    const topics = topicsBySection[section.id] || [];

                    const validTopics = topics.filter(t => t.subtopics.some(s => !s.blocked));
                    const percent =
                        validTopics.length > 0
                            ? validTopics.reduce((acc, t) => acc + t.percent, 0) / validTopics.length
                            : 0;

                    return {
                        ...section,
                        ...prompts,
                        percent,
                        topics,
                    };
                });

                response.sections = this.addStatusToSections(enrichedSections, subject.threshold);
            } else {
                const enrichedSections = sections.map(section => {
                    const prompts = resolvePrompts(section);
                    return {
                        ...section,
                        ...prompts,
                        percent: 0,
                        topics: [],
                    };
                });

                response.sections = this.addStatusToSections(enrichedSections, subject.threshold);
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

            const subtopicsPromptOwn = Boolean(section.subtopicsPrompt && section.subtopicsPrompt.trim() !== "");
            const questionPromptOwn = Boolean(section.questionPrompt && section.questionPrompt.trim() !== "");
            const solutionPromptOwn = Boolean(section.solutionPrompt && section.solutionPrompt.trim() !== "");
            const answersPromptOwn = Boolean(section.answersPrompt && section.answersPrompt.trim() !== "");
            const closedSubtopicsPromptOwn = Boolean(section.closedSubtopicsPrompt && section.closedSubtopicsPrompt.trim() !== "");

            const prompts = {
                subtopicsPrompt: subtopicsPromptOwn ? section.subtopicsPrompt.trim() : (subject.subtopicsPrompt || ""),
                subtopicsPromptOwn: subtopicsPromptOwn,

                questionPrompt: questionPromptOwn ? section.questionPrompt.trim() : (subject.questionPrompt || ""),
                questionPromptOwn: questionPromptOwn,

                solutionPrompt: solutionPromptOwn ? section.solutionPrompt.trim() : (subject.solutionPrompt || ""),
                solutionPromptOwn: solutionPromptOwn,

                answersPrompt: answersPromptOwn ? section.answersPrompt.trim() : (subject.answersPrompt || ""),
                answersPromptOwn: answersPromptOwn,

                closedSubtopicsPrompt: closedSubtopicsPromptOwn ? section.closedSubtopicsPrompt.trim() : (subject.closedSubtopicsPrompt || ""),
                closedSubtopicsPromptOwn: closedSubtopicsPromptOwn,
            };

            let enrichedSection: any = {
                ...section,
                ...prompts,
                percent: 0,
                topics: [],
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
                        select: {
                            id: true,
                            topicId: true,
                            name: true,
                            percent: true,
                            blocked: true,
                        },
                    });

                    subtopicsGrouped = subtopics.reduce((acc, sub) => {
                        if (!acc[sub.topicId]) acc[sub.topicId] = [];
                        acc[sub.topicId].push(sub);
                        return acc;
                    }, {} as Record<number, any[]>);
                }

                const topicsWithPercent = topics.map(topic => {
                    const subtopics = withSubtopics ? subtopicsGrouped[topic.id] || [] : [];
                    const validSubtopics = subtopics.filter(s => !s.blocked);
                    const percent =
                        validSubtopics.length > 0
                            ? validSubtopics.reduce((acc, s) => acc + (s.percent ?? 0), 0) / validSubtopics.length
                            : 0;

                    return {
                        ...topic,
                        percent,
                        subtopics,
                    };
                });

                const validTopics = topicsWithPercent.filter(t => t.subtopics.some(s => !s.blocked));
                const percent =
                    validTopics.length > 0
                        ? validTopics.reduce((acc, t) => acc + t.percent, 0) / validTopics.length
                        : 0;

                enrichedSection = {
                    ...enrichedSection,
                    percent,
                    topics: topicsWithPercent,
                };
            }

            const response: any = {
                statusCode: 200,
                message: 'Dział został pomyślnie pobrany',
                section: enrichedSection,
            };

            if (withSubject) {
                response.subject = subject;
            }

            return response;
        } catch (error) {
            console.error('Błąd przy pobieraniu działu:', error);
            throw new InternalServerErrorException('Nie udało się pobrać działu');
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

            const filteredData = Object.fromEntries(
                Object.entries(data).filter(([_, value]) => value !== undefined)
            );

            const updatedSection = await this.prismaService.section.update({
                where: { id },
                data: filteredData
            });

            return {
                statusCode: 200,
                message: 'Dział został pomyślnie zaktualizowany',
                section: updatedSection,
            };
        }
        catch (error) {
            throw new InternalServerErrorException('Błąd podczas aktualizacji dział');
        }
    }

    async sectionBlocked(
        subjectId: number,
        id: number
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

            if (existingSection.blocked) {
                await this.prismaService.section.update({
                    where: { id, subjectId },
                    data: { blocked: false }
                });

                await this.prismaService.topic.updateMany({
                    where: { sectionId: id, subjectId },
                    data: { blocked: false }
                });

                await this.prismaService.subtopic.updateMany({
                    where: { sectionId: id, subjectId },
                    data: { blocked: false }
                });

                return {
                    statusCode: 200,
                    message: `Dział został pomyślnie odblokowany`,
                };
            }
            else {
                await this.prismaService.section.update({
                    where: { id, subjectId },
                    data: { blocked: true }
                });

                await this.prismaService.topic.updateMany({
                    where: { sectionId: id, subjectId },
                    data: { blocked: true }
                });

                await this.prismaService.subtopic.updateMany({
                    where: { sectionId: id, subjectId },
                    data: { blocked: true }
                });

                return {
                    statusCode: 200,
                    message: `Dział został pomyślnie zablokowany`,
                };
            }
        }
        catch (error) {
            throw new InternalServerErrorException('Błąd podczas aktualizacji dział');
        }
    }
}