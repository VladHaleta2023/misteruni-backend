import { Module } from '@nestjs/common';
import { SubtopicService } from './subtopic.service';
import { SubtopicController } from './subtopic.controller';
import { HttpModule } from '@nestjs/axios';
import { TimezoneModule } from '../timezone/timezone.module';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 900000,
      maxRedirects: 5,
    }),
    AuthModule,
    TimezoneModule
  ],
  controllers: [SubtopicController],
  providers: [
    SubtopicService
  ],
  exports: [SubtopicService],
})

export class SubtopicModule {}
