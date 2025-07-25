import { IsInt, IsString, IsOptional } from 'class-validator';

export class SectionResponse {
  @IsInt()
  id: number;

  @IsString()
  name: string;

  @IsOptional()
  subjectId?: number;
}

export class TopicResponse {
  @IsInt()
  id: number;

  @IsString()
  name: string;

  @IsOptional()
  sectionId?: number;

  @IsOptional()
  subjectId?: number;
}

export class SubjectResponse {
  @IsInt()
  id: number;

  @IsString()
  name: string;

  @IsString()
  prompt: string;

  @IsOptional()
  sections?: SectionResponse[];

  @IsOptional()
  topics?: TopicResponse[];
}