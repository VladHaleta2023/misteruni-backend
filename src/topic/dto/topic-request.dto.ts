import { IsOptional, IsString } from 'class-validator';

export class TopicUpdateRequest {
  @IsOptional()
  @IsString()
  name?: string;

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
  subtopicsPrompt?: string;

  @IsOptional()
  @IsString()
  literature?: string;
}