import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class SubtopicCreateRequest {
  @IsString()
  name: string;
}

export class SubtopicUpdateRequest {
  @IsString()
  @IsOptional()
  name?: string;

  @IsInt()
  @IsOptional()
  percent?: number;

  @IsBoolean()
  @IsOptional()
  blocked?: boolean;
}