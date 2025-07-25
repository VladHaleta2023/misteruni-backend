import { Module } from '@nestjs/common';
import { OptionsService } from './options.service';
import { OptionsController } from './options.controller';
import { HttpModule } from '@nestjs/axios';
import { FASTAPI_URL } from './constans';
import { ConfigService } from '@nestjs/config';
import { SubjectModule } from 'src/subject/subject.module';

@Module({
  imports: [HttpModule, SubjectModule],
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
