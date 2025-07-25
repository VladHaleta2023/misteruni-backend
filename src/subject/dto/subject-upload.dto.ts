import { IsOptional, IsString } from 'class-validator';

export class SubjectUploadDto {
  @IsOptional()
  @IsString()
  url?: string;
}