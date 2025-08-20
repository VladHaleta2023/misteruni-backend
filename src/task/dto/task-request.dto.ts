import { IsArray, IsInt, IsString } from 'class-validator';

export class TaskCreateRequest {
  @IsString()
  text: string;

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