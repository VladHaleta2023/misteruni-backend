import { forwardRef, Module } from '@nestjs/common';
import { OptionsService } from './options.service';
import { OptionsController } from './options.controller';
import { HttpModule } from '@nestjs/axios';
import { AuthModule } from '../auth/auth.module';
import { SubjectModule } from '../subject/subject.module';
import { SubtopicModule } from '../subtopic/subtopic.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 900000,
      maxRedirects: 5,
    }),
    AuthModule,
    forwardRef(() => SubjectModule),
    SubtopicModule,
    StorageModule,
  ],
  controllers: [OptionsController],
  providers: [OptionsService],
  exports: [OptionsService],
})

export class OptionsModule {}