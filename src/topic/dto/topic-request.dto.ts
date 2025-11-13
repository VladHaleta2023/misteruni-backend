import { IsInt, IsOptional, IsString } from 'class-validator';

export class TopicUpdateRequest {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  literature?: string;

  @IsOptional()
  @IsInt()
  frequency?: number;

  @IsOptional()
  @IsString()
  note?: string;
}