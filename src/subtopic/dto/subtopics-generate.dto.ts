import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';

export class SubtopicsAIGenerate {
  @IsString()
  prompt: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  information?: string;

  @IsOptional()
  @IsString()
  accounts?: string;

  @IsOptional()
  @IsString()
  balance?: string;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsString()
  literature?: string;

  @IsString()
  changed: string;

  @IsInt()
  attempt: number;

  @IsArray()
  subtopics: [string, number][];

  @IsArray()
  @IsString({ each: true })
  errors: string[];
}

export class SubtopicsStatusAIGenerate {
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

  @IsString()
  changed: string;

  @IsInt()
  attempt: number;

  @IsArray()
  subtopics: [string, string][];

  @IsArray()
  @IsString({ each: true })
  errors: string[];
}

export class TopicExpansionAIGenerate {
  @IsString()
  prompt: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  information?: string;

  @IsOptional()
  @IsString()
  accounts?: string;

  @IsOptional()
  @IsString()
  balance?: string;

  @IsOptional()
  @IsString()
  section?: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsString()
  literature?: string;

  @IsString()
  changed: string;

  @IsInt()
  attempt: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subtopics?: string[];

  @IsString()
  note: string;

  @IsArray()
  @IsString({ each: true })
  errors: string[];
}

export class FrequencyAIGenerate {
  @IsString()
  prompt: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  information?: string;

  @IsOptional()
  @IsString()
  accounts?: string;

  @IsOptional()
  @IsString()
  balance?: string;

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
  literature?: string;

  @IsString()
  changed: string;

  @IsInt()
  attempt: number;

  @IsInt()
  frequency: number;

  @IsArray()
  @IsString({ each: true })
  errors: string[];
}

export class ChronologyAIGenerate {
  @IsString()
  prompt: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  information?: string;

  @IsOptional()
  @IsString()
  accounts?: string;

  @IsOptional()
  @IsString()
  balance?: string;

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
  literature?: string;

  @IsString()
  changed: string;

  @IsInt()
  attempt: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Array)
  subtopics?: [string, string][];

  @IsArray()
  outputSubtopics: [string, number][];

  @IsArray()
  @IsString({ each: true })
  errors: string[];
}