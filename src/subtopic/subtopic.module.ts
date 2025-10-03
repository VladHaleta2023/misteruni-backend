import { Module } from '@nestjs/common';
import { SubtopicService } from './subtopic.service';
import { SubtopicController } from './subtopic.controller';
import { HttpModule } from '@nestjs/axios';
import { FASTAPI_URL } from 'src/constans';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    HttpModule.register({
      timeout: 900000,
      maxRedirects: 5,
    })
  ],
  controllers: [SubtopicController],
  providers: [
    SubtopicService,
    {
      provide: FASTAPI_URL,
      useFactory: (configService: ConfigService) => configService.get<string>('FASTAPI_URL') || '',
      inject: [ConfigService],
    },
  ],
  exports: [SubtopicService],
})

export class SubtopicModule {}
