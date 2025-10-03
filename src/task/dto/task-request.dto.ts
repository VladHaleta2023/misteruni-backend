import { IsArray, IsInt, IsOptional, IsString } from 'class-validator';

export class TaskCreateRequest {
  @IsOptional()
  @IsInt()
  id?: number;

  @IsOptional()
  @IsInt()
  stage: number;

  @IsString()
  @IsOptional()
  text: string;

  @IsString()
  @IsOptional()
  note: string;

  @IsArray()
  @IsString({ each: true })
  options: string[]

  @IsArray()
  @IsString({ each: true })
  taskSubtopics: string[]

  @IsInt()
  correctOptionIndex: number

  @IsString()
  solution: string
}

export class TaskUserSolutionRequest {
  @IsString()
  userSolution: string;

  @IsInt()
  userOptionIndex: number;
}

export class Subtopic {
  @IsString()
  name: string;

  @IsInt()
  percent: number;
}

export class SubtopicsProgressUpdateRequest {
  @IsArray()
  subtopics: Subtopic[]

  @IsString()
  explanation: string
}