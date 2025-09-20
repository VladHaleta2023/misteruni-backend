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

    async calculateSubtopicsPercent(
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
                    where: { task: { finished: true } },
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

                await this.prismaService.subtopic.update({
                    where: { id: subtopic.id },
                    data: { percent },
                });

                return { ...subtopic, percent };
            }),
        );

        return updatedSubtopics;
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

            const resolvePrompts = (section: any) => ({
                subtopicsPrompt: section.subtopicsPrompt?.trim() || subject.subtopicsPrompt || "",
                subtopicsPromptOwn: Boolean(section.subtopicsPrompt?.trim()),

                questionPrompt: section.questionPrompt?.trim() || subject.questionPrompt || "",
                questionPromptOwn: Boolean(section.questionPrompt?.trim()),

                solutionPrompt: section.solutionPrompt?.trim() || subject.solutionPrompt || "",
                solutionPromptOwn: Boolean(section.solutionPrompt?.trim()),

                answersPrompt: section.answersPrompt?.trim() || subject.answersPrompt || "",
                answersPromptOwn: Boolean(section.answersPrompt?.trim()),

                closedSubtopicsPrompt: section.closedSubtopicsPrompt?.trim() || subject.closedSubtopicsPrompt || "",
                closedSubtopicsPromptOwn: Boolean(section.closedSubtopicsPrompt?.trim()),

                subQuestionsPrompt: section.subQuestionsPrompt?.trim() || subject.subQuestionsPrompt || "",
                subQuestionsPromptOwn: Boolean(section.subQuestionsPrompt?.trim()),

                vocabluaryPrompt: section.vocabluaryPrompt?.trim() || subject.vocabluaryPrompt || "",
                vocabluaryPromptOwn: Boolean(section.vocabluaryPrompt?.trim()),
            });

            const allTopics: any[] = [];
            let enrichedSections: any[] = [];

            if (withTopics) {
                await this.calculateSubtopicsPercent(subjectId);

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
                            sectionId: true,
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

                for (const topic of topics) {
                    const subtopics = withSubtopics ? subtopicsGrouped[topic.id] || [] : [];
                    const validSubtopics = subtopics.filter(s => !s.blocked);

                    let percent: number;

                    if (validSubtopics.length > 0) {
                        percent =
                            validSubtopics.reduce((acc, s) => acc + (s.percent ?? 0), 0) /
                            validSubtopics.length;
                    } else {
                        const tasks = await this.prismaService.task.findMany({
                            where: {
                                topicId: topic.id,
                                finished: true,
                                parentTaskId: null
                            },
                            select: { percent: true },
                        });

                        if (tasks.length > 0) {
                            percent =
                                tasks.reduce((acc, t) => acc + (t.percent ?? 0), 0) /
                                tasks.length;
                        }
                        else {
                            percent = 0;
                        }
                    }

                    await this.prismaService.topic.update({
                        where: { id: topic.id },
                        data: { percent },
                    });

                    allTopics.push({ ...topic, subtopics, percent });
                }

                const topicsBySection = allTopics.reduce<Record<number, any[]>>((acc, topic) => {
                    const sectionId = topic.sectionId;
                    if (!acc[sectionId]) acc[sectionId] = [];
                    acc[sectionId].push(topic);
                    return acc;
                }, {});

                enrichedSections = sections.map(section => {
                    const prompts = resolvePrompts(section);
                    const topics = topicsBySection[section.id] || [];
                    
                    let percent: number;
                    if (topics.length > 0) {
                        percent = topics.reduce((acc, t) => acc + t.percent, 0) / topics.length;
                    } else {
                        percent = 0;
                    }

                    return { ...section, ...prompts, topics, percent };
                });
            } else {
                enrichedSections = sections.map(section => ({
                    ...section,
                    ...resolvePrompts(section),
                    topics: [],
                    percent: 0,
                }));
            }

            const response: any = {
                statusCode: 200,
                message: 'Działy zostały pomyślnie pobrane',
                sections: this.addStatusToSections(enrichedSections, subject.threshold),
            };

            if (withSubject) {
                response.subject = subject;
            }

            const totalTopics = allTopics.length || 1;
            const counts: Record<Status, number> = { blocked: 0, started: 0, progress: 0, completed: 0 };

            allTopics.forEach(topic => {
                const pct = topic.percent ?? 0;
                let status: Status;
                if (topic.subtopics.length > 0 && topic.subtopics.every(s => s.blocked)) status = 'blocked';
                else if (pct === 0) status = 'started';
                else if (pct < subject.threshold) status = 'progress';
                else status = 'completed';
                counts[status] += 1;
            });

            const totalPercent: Record<Status, number> = {
                blocked: (counts.blocked / totalTopics) * 100,
                started: (counts.started / totalTopics) * 100,
                progress: (counts.progress / totalTopics) * 100,
                completed: (counts.completed / totalTopics) * 100,
            };

            response.total = totalPercent;

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
            const subQuestionsPromptOwn = Boolean(section.subQuestionsPrompt && section.subQuestionsPrompt.trim() !== "");
            const vocabluaryPromptOwn = Boolean(section.vocabluaryPrompt && section.vocabluaryPrompt.trim() !== "");

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

                subQuestionsPrompt: subQuestionsPromptOwn ? section.subQuestionsPrompt.trim() : (subject.subQuestionsPrompt || ""),
                subQuestionsPromptOwn: subQuestionsPromptOwn,

                vocabluaryPrompt: vocabluaryPromptOwn ? section.vocabluaryPrompt.trim() : (subject.vocabluaryPrompt || ""),
                vocabluaryPromptOwn: vocabluaryPromptOwn,
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