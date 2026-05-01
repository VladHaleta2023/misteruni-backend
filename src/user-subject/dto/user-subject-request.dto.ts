import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export enum SubjectDetailLevel {
  BASIC = "BASIC",
  EXPANDED = "EXPANDED",
  ACADEMIC = "ACADEMIC"
}

export class UserSubjectUpdateRequest {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  threshold?: number;

  @IsOptional()
  @IsEnum(SubjectDetailLevel)
  detailLevel?: SubjectDetailLevel;

  @IsOptional()
  @IsInt()
  @IsIn([30, 60, 90, 120, 150, 180])
  dailyStudyMinutes?: number;

  @IsOptional()
  @IsBoolean()
  style?: boolean;
}

export class UserSubjectCreateRequest {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  threshold?: number;

  @IsOptional()
  @IsEnum(SubjectDetailLevel)
  detailLevel?: SubjectDetailLevel;

  @IsOptional()
  @IsInt()
  @IsIn([30, 60, 90, 120, 150, 180])
  dailyStudyMinutes?: number;

  @IsOptional()
  @IsBoolean()
  style?: boolean;
}