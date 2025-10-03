import { Module } from '@nestjs/common';
import { SubtopicService } from './subtopic.service';
import { SubtopicController } from './subtopic.controller';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    HttpModule.register({
      timeout: 900000,
      maxRedirects: 5,
    })
  ],
  controllers: [SubtopicController],
  providers: [
    SubtopicService
  ],
  exports: [SubtopicService],
})

export class SubtopicModule {}
