import { IsOptional, IsString } from 'class-validator';

export class SectionUpdateRequest {
  @IsOptional()
  @IsString()
  name?: string;

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
  closedSubtopicsPrompt?: string;

  @IsOptional()
  @IsString()
  subQuestionsPrompt?: string;

  @IsOptional()
  @IsString()
  vocabluaryPrompt?: string;

  @IsOptional()
  @IsString()
  type?: string;
}