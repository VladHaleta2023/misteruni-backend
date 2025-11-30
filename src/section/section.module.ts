import { Module } from '@nestjs/common';
import { SectionService } from './section.service';
import { SectionController } from './section.controller';
import { TimezoneModule } from 'src/timezone/timezone.module';

@Module({
  imports: [TimezoneModule],
  controllers: [SectionController],
  providers: [SectionService],
})
export class SectionModule {}
