import { IsOptional, IsString } from 'class-validator';

export class SubjectCreateRequest {
  @IsString()
  name: string;

  @IsOptional()
  prompt?: string;
}

export class SubjectUpdateRequest {
  @IsOptional()
  name?: string;

  @IsOptional()
  prompt?: string;

  @IsOptional()
  subtopicsPrompt?: string;

  @IsOptional()
  subtopicsRefinePrompt?: string;

  @IsOptional()
  subtopicsCriterions?: string;

  @IsOptional()
  type?: string;
}