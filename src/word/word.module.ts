import { Module } from '@nestjs/common';
import { WordService } from './word.service';
import { WordController } from './word.controller';
import { HttpModule } from '@nestjs/axios';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 900000,
      maxRedirects: 5,
    }),
    AuthModule
  ],
  controllers: [WordController],
  providers: [WordService],
})
export class WordModule {}
