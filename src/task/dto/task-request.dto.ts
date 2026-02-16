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

  @IsArray()
  @IsString({ each: true })
  explanations: string[]

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

export class TaskUpdateChatRequest {
  @IsOptional()
  @IsString()
  chat: string;

  @IsOptional()
  @IsBoolean()
  chatFinished: boolean;

  @IsOptional()
  @IsEnum(ChatMode)
  mode: ChatMode;

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