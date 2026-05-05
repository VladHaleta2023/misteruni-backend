import { ChatMode } from '@prisma/client';
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export class TaskCreateRequest {
  @IsOptional()
  @IsInt()
  id?: number;

  @IsInt()
  stage: number;

  @IsString()
  text: string;

  @IsArray()
  @IsString({ each: true })
  options: string[]

  @IsInt()
  correctOptionIndex: number;

  @IsOptional()
  @IsString()
  explanation?: string;

  @IsArray()
  @IsString({ each: true })
  taskSubtopics: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  words?: string[]

  @IsOptional()
  @IsInt()
  percent?: number

  @IsString()
  solution: string
}

export class TaskUpdateRequest {
  @IsOptional()
  @IsBoolean()
  finished: boolean;
}

export class TaskUpdateChatRequest {
  @IsOptional()
  @IsString()
  chat: string;

  @IsOptional()
  @IsBoolean()
  chatFinished: boolean;

  @IsOptional()
  @IsString()
  userSolution: string;
}

export class TaskUserSolutionRequest {
  @IsString()
  userSolution: string;

  @IsInt()
  userOptionIndex: number;
}

export class SolutionGuideRequest {
  @IsString()
  solution: string;
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