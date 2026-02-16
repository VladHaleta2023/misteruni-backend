import { IsArray, IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class TopicUpdateRequest {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  literature?: string;

  @IsOptional()
  @IsInt()
  frequency?: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsArray()
  outputSubtopics?: [string, number][];
}

export class WordsAIGenerate {
  @IsString()
  prompt: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsString()
  difficulty?: string;

  @IsString()
  changed: string;

  @IsInt()
  attempt: number;

  @IsArray()
  words: [string, number][];

  @IsArray()
  @IsString({ each: true })
  errors: string[];
}

export class Word {
  text: string
  frequency: number;
}