import { Controller, Delete, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Delete('deleteS3Files')
  async cleanupOrphanedFiles() {
    return this.appService.cleanupOrphanedFiles();
  }

  @Post('copy-subject')
  async copySubject() {
    return this.appService.copySubject();
  }

  @Post('copy-words')
  async copyWords() {
    return this.appService.copyWords();
  }
}
