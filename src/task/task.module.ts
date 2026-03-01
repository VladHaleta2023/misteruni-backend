import { forwardRef, Module } from '@nestjs/common';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { HttpModule } from '@nestjs/axios';
import { SubtopicModule } from '../subtopic/subtopic.module';
import { OptionsModule } from '../options/options.module';
import { TimezoneModule } from '../timezone/timezone.module';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { SubjectModule } from '../subject/subject.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 900000,
      maxRedirects: 5,
    }),
    AuthModule,
    StorageModule,
    SubtopicModule,
    OptionsModule,
    TimezoneModule,
    forwardRef(() => SubjectModule),
  ],
  controllers: [TaskController],
  providers: [
    TaskService
  ],
  exports: [
    TaskService
  ]
})

export class TaskModule {}
export { StorageModule }
