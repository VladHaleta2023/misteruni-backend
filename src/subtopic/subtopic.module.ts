import { Module } from '@nestjs/common';
import { SubtopicService } from './subtopic.service';
import { SubtopicController } from './subtopic.controller';
import { HttpModule } from '@nestjs/axios';
import { FASTAPI_URL } from './constans';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [HttpModule],
  controllers: [SubtopicController],
  providers: [
    SubtopicService,
    {
      provide: FASTAPI_URL,
      useFactory: (configService: ConfigService) => configService.get<string>('FASTAPI_URL') || '',
      inject: [ConfigService],
    },
  ],
})
export class SubtopicModule {}
