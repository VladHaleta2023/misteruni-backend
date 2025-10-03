import { Module } from '@nestjs/common';
import { OptionsService } from './options.service';
import { OptionsController } from './options.controller';
import { HttpModule } from '@nestjs/axios';
import { StorageModule, SubjectModule } from '../subject/subject.module';
import { SubtopicModule } from '../subtopic/subtopic.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 900000,
      maxRedirects: 5,
    }),
    SubjectModule,
    SubtopicModule,
    StorageModule
  ],
  controllers: [OptionsController],
  providers: [
    OptionsService
  ],
  exports: [OptionsService],
})
export class OptionsModule {}
