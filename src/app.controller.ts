import { Body, Controller, Delete, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Delete('deleteS3Files')
  async cleanupOrphanedFiles() {
    return this.appService.cleanupOrphanedFiles();
  }

  @Post('copy-words')
  async copyWords() {
    return this.appService.copyWords();
  }

  @Post('get-information')
  async getSubjectInformation(
    @Body('subjectId') subjectId: number
  ) {
    return this.appService.getSubjectInformation(subjectId);
  }
}
