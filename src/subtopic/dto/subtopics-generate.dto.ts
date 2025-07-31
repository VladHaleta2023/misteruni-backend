import { IsArray, IsInt, IsOptional, IsString } from 'class-validator';

export class SubtopicsAIGenerate {
  @IsString()
  prompt: string;

  @IsOptional()
  subject?: string;

  @IsOptional()
  section?: string;

  @IsOptional()
  topic?: string;

  @IsString()
  changed: string;

  @IsInt()
  attempt: number;

  @IsArray()
  @IsString({ each: true })
  subtopics: string[];
}