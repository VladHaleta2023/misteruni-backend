import { Module } from '@nestjs/common';
import { TopicService } from './topic.service';
import { TopicController } from './topic.controller';
import { TimezoneModule } from '../timezone/timezone.module';
import { HttpModule } from '@nestjs/axios';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 900000,
      maxRedirects: 5,
    }),
    AuthModule,
    TimezoneModule
  ],
  controllers: [TopicController],
  providers: [TopicService],
})
export class TopicModule {}
