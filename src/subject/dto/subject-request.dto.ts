import { IsArray, IsInt, IsOptional, IsString } from 'class-validator';

export class SubjectCreateRequest {
  @IsString()
  name: string;

  @IsOptional()
  prompt?: string;
}

export class SubjectUpdateRequest {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  prompt?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  subtopicsPrompt?: string;

  @IsOptional()
  @IsString()
  subtopicsStatusPrompt?: string;

  @IsOptional()
  @IsString()
  questionPrompt?: string;

  @IsOptional()
  @IsString()
  solutionPrompt?: string;

  @IsOptional()
  @IsString()
  answersPrompt?: string;

  @IsOptional()
  @IsString()
  closedProblemsPrompt?: string;

  @IsOptional()
  @IsString()
  vocabluaryPrompt?: string;

  @IsOptional()
  @IsString()
  wordsPrompt?: string;

  @IsOptional()
  @IsString()
  chatPrompt?: string;

  @IsOptional()
  @IsString()
  closedSubtopicsPrompt?: string;

  @IsOptional()
  @IsString()
  topicExpansionPrompt?: string;

  @IsOptional()
  @IsString()
  topicFrequencyPrompt?: string;

  @IsOptional()
  @IsString()
  literaturePrompt?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  accounts?: string;

  @IsOptional()
  @IsString()
  balance?: string;
}

export class LiteratureUpdateRequest {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class LiteratureAIGenerate {
  @IsOptional()
  @IsString()
  prompt?: string;

  @IsString()
  changed: string;

  @IsInt()
  attempt: number;

  @IsString()
  name: string;

  @IsString()
  note: string;

  @IsArray()
  @IsString({ each: true })
  errors: string[];
}