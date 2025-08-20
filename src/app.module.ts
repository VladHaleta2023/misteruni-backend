import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { SubjectModule } from './subject/subject.module';
import { StorageModule } from './storage/storage.module';
import { SectionModule } from './section/section.module';
import { TopicModule } from './topic/topic.module';
import { OptionsModule } from './options/options.module';
import { SubtopicModule } from './subtopic/subtopic.module';
import { TaskModule } from './task/task.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    SubjectModule,
    StorageModule,
    SectionModule,
    TopicModule,
    OptionsModule,
    SubtopicModule,
    TaskModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})

export class AppModule {}