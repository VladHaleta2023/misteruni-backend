import { Module } from '@nestjs/common';
import { UserSubjectService } from './user-subject.service';
import { UserSubjectController } from './user-subject.controller';
import { AuthModule } from '../auth/auth.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    AuthModule,
    HttpModule.register({
      timeout: 900000,
      maxRedirects: 5,
    }),
  ],
  controllers: [UserSubjectController],
  providers: [UserSubjectService],
})
export class UserSubjectModule {}
