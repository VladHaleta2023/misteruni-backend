import { Module } from '@nestjs/common';
import { SubtopicService } from './subtopic.service';
import { SubtopicController } from './subtopic.controller';
import { HttpModule } from '@nestjs/axios';
import { TimezoneModule } from '../timezone/timezone.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 900000,
      maxRedirects: 5,
    }),
    TimezoneModule
  ],
  controllers: [SubtopicController],
  providers: [
    SubtopicService
  ],
  exports: [SubtopicService],
})

export class SubtopicModule {}
