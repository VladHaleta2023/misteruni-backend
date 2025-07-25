import { IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class AudioTranscribeDto {
  @Type(() => Number)
  @IsInt()
  part_id: number;

  @IsOptional()
  @IsString()
  language?: string;
}