import { Module } from '@nestjs/common';
import { ExamService } from './exam.service';
import { ExamController } from './exam.controller';
import { AuthModule } from '../auth/auth.module';
import { HttpModule } from '@nestjs/axios';
import { TimezoneModule } from '../timezone/timezone.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 900000,
      maxRedirects: 5,
    }),
    AuthModule,
    TimezoneModule
  ],
  controllers: [ExamController],
  providers: [ExamService],
  exports: [ExamService]
})
export class ExamModule {}
