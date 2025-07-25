import { IsString } from 'class-validator';

export class FullPlanRequestDto {
  @IsString()
  prompt: string;
}