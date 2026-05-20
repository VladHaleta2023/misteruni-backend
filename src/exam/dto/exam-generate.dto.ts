import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class ExamAIGenerateTopic {
  @IsInt()
  id: number;

  @IsString()
  name: string;

  @IsInt()
  frequency: number;

  @IsInt()
  percent: number;

  @IsInt()
  time: number;

  @IsString()
  type: string;
}

export class ExamAIGenerate {
  @IsOptional()
  @IsString()
  prompt?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  examTemplates?: string;

  @IsOptional()
  @IsInt()
  totalTimeSpentSeconds?: number;

  @IsArray()
  @IsInt({ each: true })
  outputTopics: number[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExamAIGenerateTopic)
  topics?: ExamAIGenerateTopic[]

  @IsString()
  changed: string;

  @IsInt()
  attempt: number;

  @IsArray()
  @IsString({ each: true })
  errors: string[];
}