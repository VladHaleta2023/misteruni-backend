import { Type } from 'class-transformer';
import { ArrayMinSize, ArrayNotEmpty, IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';

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

export class SubtopicUpdateItem {
  @IsString()
  name: string;

  @IsString()
  level: string;
}

export class UpdateSubtopicsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true }) // каждый элемент массива должен быть строкой
  subtopics: string[];
}