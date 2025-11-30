import { Module } from '@nestjs/common';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { HttpModule } from '@nestjs/axios';
import { SubtopicModule } from '../subtopic/subtopic.module';
import { OptionsModule } from '../options/options.module';
import { TimezoneModule } from 'src/timezone/timezone.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 900000,
      maxRedirects: 5,
    }),
    SubtopicModule,
    OptionsModule,
    TimezoneModule
  ],
  controllers: [TaskController],
  providers: [
    TaskService
  ],
})

export class TaskModule {}
