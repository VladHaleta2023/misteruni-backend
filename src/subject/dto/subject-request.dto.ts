import { IsInt, IsOptional, IsString } from 'class-validator';

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
  questionPrompt?: string;

  @IsOptional()
  @IsString()
  solutionPrompt?: string;

  @IsOptional()
  @IsString()
  answersPrompt?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsInt()
  difficulty?: number;

  @IsOptional()
  @IsInt()
  threshold?: number;
}