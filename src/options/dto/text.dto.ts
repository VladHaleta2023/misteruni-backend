import { IsInt, IsString } from 'class-validator';

export class TextDto {
  @IsString()
  text: string;
}