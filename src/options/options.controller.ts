import {
  BadRequestException,
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Get,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { OptionsService } from './options.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { AudioTranscribeDto } from './dto/audioTranscribe.dto';
import { SplitIntoSentencesDto } from './dto/splitIntoSentences.dto';
import { TextDto } from './dto/text.dto';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_EXTENSIONS = [
  '.wav', '.mp3', '.ogg', '.flac', '.m4a', '.aac', '.wma', '.opus',
  '.amr', '.aiff', '.alac', '.pcm', '.webm', '.mp4', '.3gp', '.caf',
];

interface SplitIntoSentencesResponse {
  sentences: string[];
}

interface AudioTranscribeResponse {
  part_id: number;
  transcription: string;
  language: string;
  language_probability: number;
  subject: string;
}

@Controller('options')
export class OptionsController {
  constructor(private readonly optionsService: OptionsService) {}

  @Post(':subjectId/audio-transcribe')
  @UseInterceptors(FileInterceptor('file'))
  async audioTranscribePart(
    @Param('subjectId', ParseIntPipe) subjectId: number,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: AudioTranscribeDto,
  )
  : Promise<AudioTranscribeResponse & { statusCode: number; message: string }> {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new BadRequestException(`Unsupported file extension: ${ext}`);
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(`File size is too large. Maximum allowed is ${MAX_FILE_SIZE / (1024 * 1024)} MB.`);
    }

    const { part_id, language } = body;

    return this.optionsService.audioTranscribePart({
      subjectId,
      file,
      part_id,
      language,
    });
  }

  @Post('split-into-sentences')
  async textSplitIntoSentences(@Body() body: SplitIntoSentencesDto)
  : Promise<SplitIntoSentencesResponse & { statusCode: number; message: string }>
  {
    const { text, language } = body;

    return this.optionsService.textSplitIntoSentences(text, language);
  }

  // Функции временные (опциональные!)
  @Post('text')
  async addTextOption(@Body() body: TextDto) {
    const { text } = body;

    return this.optionsService.addTextOption(text);
  }

  @Put('text/:id')
  async updateTextOption(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: TextDto
  ) {
    const { text } = body;

    return this.optionsService.updateTextOption(id, text);
  }

  @Post('text/:id/tss')
  async generateTTS(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: TextDto & { part_id: number, language?: string }
  ) {
    const { text, part_id } = body;
    let { language } = body;
    language = language ?? 'ru';

    return this.optionsService.generateTTS(id, text, part_id, language);
  }

  @Get('text/:id/audioFiles')
  async findAllAudioFilesByTextId(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.optionsService.findAllAudioFilesByTextId(id);
  }
}