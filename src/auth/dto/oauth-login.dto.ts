import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AuthProvider } from '@prisma/client';

export class OAuthLoginDto {
  @IsEnum(AuthProvider)
  provider: AuthProvider;

  @IsString()
  @IsNotEmpty()
  providerId: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  username?: string;
}