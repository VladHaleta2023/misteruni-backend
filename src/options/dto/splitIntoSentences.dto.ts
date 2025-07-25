import { IsOptional, IsString } from 'class-validator';

export class SplitIntoSentencesDto {
  @IsString()
  text: string;

  @IsOptional()
  @IsString()
  language?: string;
}