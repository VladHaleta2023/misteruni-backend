import { Module } from '@nestjs/common';
import { SubtopicService } from './subtopic.service';
import { SubtopicController } from './subtopic.controller';

@Module({
  controllers: [SubtopicController],
  providers: [SubtopicService],
})
export class SubtopicModule {}
