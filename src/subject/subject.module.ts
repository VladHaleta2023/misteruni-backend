import { forwardRef, Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { SubjectController } from './subject.controller';
import { HttpModule } from '@nestjs/axios';
import { SubjectService } from './subject.service'; 
import { SubtopicModule } from '../subtopic/subtopic.module';
import { TimezoneModule } from '../timezone/timezone.module';
import { AuthModule } from '../auth/auth.module';
import { TaskModule } from '../task/task.module';
import { ExamModule } from '../exam/exam.module';
import { SectionModule } from '../section/section.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 900000,
      maxRedirects: 5,
    }),
    StorageModule,
    AuthModule,
    ExamModule,
    SectionModule,
    SubtopicModule,
    TimezoneModule,
    forwardRef(() => TaskModule),
  ],
  controllers: [SubjectController],
  providers: [
    SubjectService
  ],
  exports: [SubjectService],
})
export class SubjectModule {}
export { StorageModule };

