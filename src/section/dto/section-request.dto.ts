import { IsOptional } from 'class-validator';

export class SectionUpdateRequest {
  @IsOptional()
  name?: string;

  @IsOptional()
  subtopicsPrompt?: string;

  @IsOptional()
  subtopicsRefinePrompt?: string;

  @IsOptional()
  subtopicsCriterions?: string;

  @IsOptional()
  type?: string;
}