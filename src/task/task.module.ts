import { Module } from '@nestjs/common';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { HttpModule } from '@nestjs/axios';
import { FASTAPI_URL } from 'src/constans';
import { ConfigService } from '@nestjs/config';
import { SubtopicModule } from 'src/subtopic/subtopic.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 900000,
      maxRedirects: 5,
    }),
    SubtopicModule
  ],
  controllers: [TaskController],
  providers: [
    TaskService,
    {
      provide: FASTAPI_URL,
      useFactory: (configService: ConfigService) => configService.get<string>('FASTAPI_URL') || '',
      inject: [ConfigService],
    },
  ],
})

export class TaskModule {}
