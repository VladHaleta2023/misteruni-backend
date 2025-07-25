import { Module } from '@nestjs/common';
import { StorageModule } from 'src/storage/storage.module';
import { SubjectController } from './subject.controller';
import { HttpModule } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { FASTAPI_URL } from './constans';
import { SubjectService } from './subject.service'; 

@Module({
  imports: [HttpModule, StorageModule],
  controllers: [SubjectController],
  providers: [
    SubjectService,
    {
      provide: FASTAPI_URL,
      useFactory: (configService: ConfigService) => configService.get<string>('FASTAPI_URL') || '',
      inject: [ConfigService],
    },
  ],
  exports: [SubjectService],
})
export class SubjectModule {}
export { StorageModule };

