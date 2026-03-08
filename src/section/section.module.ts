import { Module } from '@nestjs/common';
import { SectionService } from './section.service';
import { SectionController } from './section.controller';
import { TimezoneModule } from '../timezone/timezone.module';
import { AuthModule } from '../auth/auth.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    HttpModule.register({
      timeout: 900000,
      maxRedirects: 5,
    }),
    TimezoneModule,
    AuthModule,
  ],
  controllers: [SectionController],
  providers: [SectionService],
})
export class SectionModule {}