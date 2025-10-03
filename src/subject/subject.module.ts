import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { SubjectController } from './subject.controller';
import { HttpModule } from '@nestjs/axios';
import { SubjectService } from './subject.service'; 
import { SubtopicModule } from '../subtopic/subtopic.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 900000,
      maxRedirects: 5,
    }),
    StorageModule,
    SubtopicModule,
  ],
  controllers: [SubjectController],
  providers: [
    SubjectService
  ],
  exports: [SubjectService],
})
export class SubjectModule {}
export { StorageModule };

