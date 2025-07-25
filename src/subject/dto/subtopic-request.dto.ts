import { IsString } from 'class-validator';

export class SubtopicCreateRequest {
  @IsString()
  name: string;
}