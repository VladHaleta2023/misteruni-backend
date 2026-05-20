import { IsArray, IsInt } from 'class-validator';

export class ExamCreateRequest {
  @IsArray()
  @IsInt({ each: true })
  topics: number[];
}