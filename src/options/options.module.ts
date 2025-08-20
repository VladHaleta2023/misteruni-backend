import { Module } from '@nestjs/common';
import { OptionsService } from './options.service';
import { OptionsController } from './options.controller';
import { HttpModule } from '@nestjs/axios';
import { FASTAPI_URL } from 'src/constans';
import { ConfigService } from '@nestjs/config';
import { SubjectModule } from 'src/subject/subject.module';
import { SubtopicModule } from 'src/subtopic/subtopic.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 900000,
      maxRedirects: 5,
    }),
    SubjectModule,
    SubtopicModule
  ],
  controllers: [OptionsController],
  providers: [
    OptionsService,
    {
      provide: FASTAPI_URL,
      useFactory: (configService: ConfigService) => configService.get<string>('FASTAPI_URL') || '',
      inject: [ConfigService],
    },
  ],
})
export class OptionsModule {}
