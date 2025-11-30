import { Module } from '@nestjs/common';
import { TopicService } from './topic.service';
import { TopicController } from './topic.controller';
import { TimezoneModule } from 'src/timezone/timezone.module';

@Module({
  imports: [TimezoneModule],
  controllers: [TopicController],
  providers: [TopicService],
})
export class TopicModule {}
