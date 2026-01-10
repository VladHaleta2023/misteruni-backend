import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export enum SubjectDetailLevel {
  MANDATORY = "MANDATORY",
  DESIRABLE = "DESIRABLE",
  OPTIONAL = "OPTIONAL"
}

export class UserSubjectUpdateRequest {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  threshold?: number;

  @IsOptional()
  @IsEnum(SubjectDetailLevel)
  detailLevel?: SubjectDetailLevel;
}

export class UserSubjectCreateRequest {
  @IsInt()
  @Min(0)
  @Max(100)
  threshold: number;

  @IsEnum(SubjectDetailLevel)
  detailLevel: SubjectDetailLevel;
}