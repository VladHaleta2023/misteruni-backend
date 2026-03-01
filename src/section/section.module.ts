import { Module } from '@nestjs/common';
import { SectionService } from './section.service';
import { SectionController } from './section.controller';
import { TimezoneModule } from '../timezone/timezone.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TimezoneModule,
    AuthModule,
  ],
  controllers: [SectionController],
  providers: [SectionService],
})
export class SectionModule {}