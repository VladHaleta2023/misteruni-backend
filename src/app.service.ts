import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { StorageService } from './storage/storage.service';

@Injectable()
export class AppService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly storageService: StorageService,
    ) {}

    private extractKeyFromUrl(fileUrl: string): string | null {
        try {
            const url = new URL(fileUrl);
            return decodeURIComponent(url.pathname.substring(1));
        } catch (e) {
            console.error('Nie udało się wyciągnąć klucza z URL:', e);
            return null;
        }
    }
    
    private async getAllFilesFromDatabase(): Promise<string[]> {
        const files: string[] = [];

        try {
            const audioFiles = await this.prismaService.audioFile.findMany({
                select: { url: true },
            });
            files.push(...audioFiles.map(file => file.url).filter(url => url));
            
            const subjects = await this.prismaService.subject.findMany({
                select: { url: true },
            });
            files.push(...subjects.map(subject => subject.url!).filter(url => url));
            
            const uniqueFiles = [...new Set(files)].filter(Boolean);

            return uniqueFiles;
        }
        catch (error) {
            console.error(error);
            return [];
        }
    }

    private async deleteOrphanedFiles(fileUrls: string[]) {
        const deleted: string[] = [];
        const errors: Array<{ fileUrl: string; error: string }> = [];

        for (const fileUrl of fileUrls) {
            try {
                const key = this.extractKeyFromUrl(fileUrl);
                
                if (!key) {
                    errors.push({ fileUrl, error: 'Format Error URL' });
                    continue;
                }

                await this.storageService.deleteFile(key);
                deleted.push(fileUrl);

            } catch (error) {
                console.log(error);
                errors.push({ fileUrl, error: error.message });
            }
        }

        return { deleted, errors };
    }

    async cleanupOrphanedFiles() {
        try {
            const allFilesInStorage = await this.storageService.getAllFileUrls();

            const allFilesInDatabase = await this.getAllFilesFromDatabase();

            const orphanedFiles = allFilesInStorage.filter(
                storageFile => !allFilesInDatabase.includes(storageFile)
            );

            if (orphanedFiles.length === 0) {
                return {
                    success: true,
                    message: 'Nie ma plików do usuwania',
                    stats: {
                        totalFilesInStorage: allFilesInStorage.length,
                        totalFilesInDatabase: allFilesInDatabase.length,
                        orphanedFilesFound: 0,
                        filesDeleted: 0,
                        deleteErrors: 0,
                    },
                };
            }

            const deletionResults = await this.deleteOrphanedFiles(orphanedFiles);

            const result = {
                success: deletionResults.errors.length === 0,
                message: deletionResults.errors.length === 0
                ? `Success deleted ${deletionResults.deleted.length} files`
                : `Deleted ${deletionResults.deleted.length} files, ${deletionResults.errors.length} errors`,
                stats: {
                    totalFilesInStorage: allFilesInStorage.length,
                    totalFilesInDatabase: allFilesInDatabase.length,
                    orphanedFilesFound: orphanedFiles.length,
                    filesDeleted: deletionResults.deleted.length,
                    deleteErrors: deletionResults.errors.length,
                },
                deletedFiles: deletionResults.deleted,
                errors: deletionResults.errors.length > 0 ? deletionResults.errors : undefined,
            };

            return result;
        } catch (error) {
            console.error(error);
        }
    }

    async copySubject(userId: number = 1) {
        try {
            const sourceSubject = await this.prismaService.subject.findUnique({
                where: { id: 6 },
                include: {
                    sections: {
                        include: {
                            topics: {
                                include: {
                                    subtopics: true
                                }
                            },
                            subtopics: true
                        }
                    },
                }
            });

            if (!sourceSubject) {
                console.log('Предмет с ID 6 не найден');
                return;
            }

            const { id: oldSubjectId, name: oldSubjectName, sections, ...subjectData } = sourceSubject;
            
            const newSubject = await this.prismaService.subject.create({
                data: {
                    name: "Język Angielski",
                    prompt: subjectData.prompt,
                    url: subjectData.url,
                    type: subjectData.type,
                    subtopicsPrompt: subjectData.subtopicsPrompt,
                    questionPrompt: subjectData.questionPrompt,
                    solutionPrompt: subjectData.solutionPrompt,
                    answersPrompt: subjectData.answersPrompt,
                    closedSubtopicsPrompt: subjectData.closedSubtopicsPrompt,
                    vocabluaryPrompt: subjectData.vocabluaryPrompt,
                    wordsPrompt: subjectData.wordsPrompt,
                    topicExpansionPrompt: subjectData.topicExpansionPrompt,
                }
            });

            console.log(`Создан новый предмет: ${newSubject.name} (ID: ${newSubject.id}) для пользователя ${userId}`);

            const sectionMap = new Map<number, number>();
            
            for (const section of sourceSubject.sections) {
                const { 
                    id: oldSectionId, 
                    topics, 
                    subtopics, 
                    subjectId: oldSectionSubjectId,
                    ...sectionData 
                } = section;
                
                const newSection = await this.prismaService.section.create({
                    data: {
                        name: sectionData.name,
                        subjectId: newSubject.id,
                        partId: sectionData.partId,
                        type: sectionData.type,
                        subtopicsPrompt: sectionData.subtopicsPrompt,
                        questionPrompt: sectionData.questionPrompt,
                        solutionPrompt: sectionData.solutionPrompt,
                        answersPrompt: sectionData.answersPrompt,
                        closedSubtopicsPrompt: sectionData.closedSubtopicsPrompt,
                        vocabluaryPrompt: sectionData.vocabluaryPrompt,
                        wordsPrompt: sectionData.wordsPrompt,
                        topicExpansionPrompt: sectionData.topicExpansionPrompt,
                        difficulty: sectionData.difficulty,
                    }
                });
                
                sectionMap.set(oldSectionId, newSection.id);
                console.log(`Скопирован раздел: ${section.name} (${oldSectionId} → ${newSection.id})`);
            }

            const topicMap = new Map<number, number>();
            
            for (const section of sourceSubject.sections) {
                for (const topic of section.topics) {
                    const { 
                        id: oldTopicId, 
                        subtopics, 
                        sectionId: oldTopicSectionId,
                        subjectId: oldTopicSubjectId,
                        ...topicData 
                    } = topic;
                    
                    const newTopic = await this.prismaService.topic.create({
                        data: {
                            name: topicData.name,
                            subjectId: newSubject.id,
                            sectionId: sectionMap.get(topic.sectionId)!,
                            partId: topicData.partId,
                            questionPrompt: topicData.questionPrompt,
                            solutionPrompt: topicData.solutionPrompt,
                            answersPrompt: topicData.answersPrompt,
                            closedSubtopicsPrompt: topicData.closedSubtopicsPrompt,
                            subtopicsPrompt: topicData.subtopicsPrompt,
                            vocabluaryPrompt: topicData.vocabluaryPrompt,
                            wordsPrompt: topicData.wordsPrompt,
                            literature: topicData.literature,
                            frequency: topicData.frequency,
                            topicExpansionPrompt: topicData.topicExpansionPrompt,
                            note: topicData.note,
                        }
                    });
                    
                    topicMap.set(oldTopicId, newTopic.id);
                    console.log(`Скопирована тема: ${topic.name} (${oldTopicId} → ${newTopic.id})`);
                }
            }

            const subtopicMap = new Map<number, number>();
            
            for (const section of sourceSubject.sections) {
                for (const subtopic of section.subtopics) {
                    const { 
                        id: oldSubtopicId,
                        sectionId: oldSubtopicSectionId,
                        subjectId: oldSubtopicSubjectId,
                        topicId: oldSubtopicTopicId,
                        ...subtopicData 
                    } = subtopic;
                    
                    const newSubtopic = await this.prismaService.subtopic.create({
                        data: {
                            name: subtopicData.name,
                            importance: subtopicData.importance,
                            subjectId: newSubject.id,
                            sectionId: sectionMap.get(subtopic.sectionId)!,
                            topicId: topicMap.get(subtopic.topicId)!,
                        }
                    });
                    
                    subtopicMap.set(oldSubtopicId, newSubtopic.id);
                    console.log(`Скопирован подтема: ${subtopic.name} (${oldSubtopicId} → ${newSubtopic.id})`);
                }
            }

            const sourceWords = await this.prismaService.word.findMany({
                where: {
                    subjectId: 6,
                    userId: userId,
                },
                include: {
                    topic: true
                }
            });

            console.log(`Найдено ${sourceWords.length} слов пользователя ${userId} в предмете 6 для копирования`);

            let copiedWordsCount = 0;
            let skippedWordsCount = 0;

            for (const word of sourceWords) {
                try {
                    let newTopicId: number | null = null;

                    if (word.topicId !== null && word.topicId !== undefined && word.topic) {
                        const mappedTopicId = topicMap.get(word.topicId);
                        
                        if (mappedTopicId !== undefined) {
                            newTopicId = mappedTopicId;
                        } else {
                            console.log(`⚠️ Не найдена новая тема для слова "${word.text}" (старая topicId: ${word.topicId})`);
                            skippedWordsCount++;
                            continue;
                        }
                    }

                    const existingWord = await this.prismaService.word.findUnique({
                        where: {
                            word_user_subject_unique: {
                                userId: userId,
                                subjectId: newSubject.id,
                                text: word.text
                            }
                        }
                    });

                    if (existingWord) {
                        console.log(`⏭️ Слово "${word.text}" уже существует у пользователя ${userId} в предмете ${newSubject.id}`);
                        skippedWordsCount++;
                        continue;
                    }

                    await this.prismaService.word.create({
                        data: {
                            text: word.text,
                            finished: word.finished,
                            frequency: word.frequency,
                            streakCorrectCount: word.streakCorrectCount,
                            totalAttemptCount: word.totalAttemptCount,
                            totalCorrectCount: word.totalCorrectCount,
                            userId: userId,
                            subjectId: newSubject.id,
                            topicId: newTopicId,
                        }
                    });

                    copiedWordsCount++;
                    console.log(`✅ Скопировано слово: "${word.text}" для пользователя ${userId}`);
                    
                } catch (error) {
                    if (error.code === 'P2002') {
                        skippedWordsCount++;
                        console.log(`⚠️ Дубликат слова: "${word.text}" для пользователя ${userId}`);
                    } else {
                        console.error(`❌ Ошибка при копировании слова "${word.text}":`, error);
                        throw error;
                    }
                }
            }

            console.log('\n' + '='.repeat(50));
            console.log('✅ ОТЧЕТ О КОПИРОВАНИИ ПРЕДМЕТА');
            console.log('='.repeat(50));
            console.log(`👤 Пользователь: ${userId}`);
            console.log(`📚 Исходный предмет: ${sourceSubject.name} (ID: 6)`);
            console.log(`🆕 Новый предмет: ${newSubject.name} (ID: ${newSubject.id})`);
            console.log('─'.repeat(50));
            console.log(`📂 Разделы: ${sectionMap.size} скопировано`);
            console.log(`📝 Темы: ${topicMap.size} скопировано`);
            console.log(`📌 Подтемы: ${subtopicMap.size} скопировано`);
            console.log(`🔤 Слова: ${copiedWordsCount} скопировано, ${skippedWordsCount} пропущено`);
            console.log('='.repeat(50));

            return {
                success: true,
                userId: userId,
                sourceSubject: {
                    id: 6,
                    name: sourceSubject.name
                },
                newSubject: {
                    id: newSubject.id,
                    name: newSubject.name
                },
                stats: {
                    sections: sectionMap.size,
                    topics: topicMap.size,
                    subtopics: subtopicMap.size,
                    words: {
                        total: sourceWords.length,
                        copied: copiedWordsCount,
                        skipped: skippedWordsCount
                    }
                }
            };

        } catch (error) {
            console.error('❌ Ошибка при копировании предмета:', error);
            throw new InternalServerErrorException('Nie udało się skopiować przedmiotu');
        }
    }

    async copyWords(userId: number = 1) {
        try {
            const sourceWords = await this.prismaService.word.findMany({
                where: {
                    subjectId: 6,
                    userId: userId,
                },
                include: {
                    topic: true
                }
            });

            console.log(`Найдено ${sourceWords.length} слов пользователя ${userId} в предмете 6 для копирования`);

            let copiedWordsCount = 0;
            let skippedWordsCount = 0;

            // Получаем новый предмет
            const newSubject = await this.prismaService.subject.findUnique({
                where: { id: 8 }
            });

            if (!newSubject) {
                throw new Error(`Предмет с id=8 не найден`);
            }

            for (const word of sourceWords) {
                try {
                    let newTopicId: number | null = null;

                    // Если у слова есть тема, ищем такую же в новом предмете
                    if (word.topicId !== null && word.topicId !== undefined && word.topic) {
                        // Ищем тему с таким же названием в новом предмете
                        const existingTopic = await this.prismaService.topic.findFirst({
                            where: {
                                subjectId: newSubject.id,
                                name: word.topic.name
                            }
                        });

                        // Если тема не найдена - выходим из всей функции
                        if (!existingTopic) {
                            console.error(`❌ Тема "${word.topic.name}" не найдена в предмете ${newSubject.id}. Прекращаем копирование.`);
                            throw new Error(`Тема "${word.topic.name}" не найдена в целевом предмете`);
                        }

                        newTopicId = existingTopic.id;
                    }

                    // Проверяем, существует ли уже такое слово у пользователя в новом предмете
                    const existingWord = await this.prismaService.word.findFirst({
                        where: {
                            userId: userId,
                            subjectId: newSubject.id,
                            text: word.text,
                            ...(newTopicId ? { topicId: newTopicId } : { topicId: null })
                        }
                    });

                    if (existingWord) {
                        console.log(`⏭️ Слово "${word.text}" уже существует у пользователя ${userId} в предмете ${newSubject.id}${newTopicId ? ` в теме ${newTopicId}` : ''}`);
                        skippedWordsCount++;
                        continue;
                    }

                    // Создаем новое слово
                    await this.prismaService.word.create({
                        data: {
                            text: word.text,
                            finished: word.finished,
                            frequency: word.frequency,
                            streakCorrectCount: word.streakCorrectCount,
                            totalAttemptCount: word.totalAttemptCount,
                            totalCorrectCount: word.totalCorrectCount,
                            userId: userId,
                            subjectId: newSubject.id,
                            topicId: newTopicId,
                        }
                    });

                    copiedWordsCount++;
                    console.log(`✅ Скопировано слово: "${word.text}" для пользователя ${userId} в предмет ${newSubject.id}${newTopicId ? ` с темой ${newTopicId}` : ''}`);
                    
                } catch (error) {
                    // Если это ошибка о не найденной теме - прокидываем дальше (выход из всей функции)
                    if (error.message && error.message.includes('Тема') && error.message.includes('не найдена')) {
                        throw error; // Выходим из всей функции
                    }
                    
                    if (error.code === 'P2002') {
                        skippedWordsCount++;
                        console.log(`⚠️ Дубликат слова: "${word.text}" для пользователя ${userId}`);
                    } else {
                        console.error(`❌ Ошибка при копировании слова "${word.text}":`, error);
                        // Можно продолжить копирование других слов или прервать
                        // throw error; // раскомментировать, если нужно прервать при ошибке
                    }
                }
            }

            console.log(`📊 Итог: скопировано ${copiedWordsCount} слов, пропущено ${skippedWordsCount} слов`);
            
        } catch (error) {
            console.error('❌ Ошибка при копировании слов:', error);
            throw new InternalServerErrorException('Не удалось скопировать предмет');
        } 
    }
}