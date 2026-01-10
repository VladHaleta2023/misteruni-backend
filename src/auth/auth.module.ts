import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { GoogleStrategy } from './strategies/google.strategy';
import { FacebookStrategy } from './strategies/facebook.strategy';
import { GoogleAdminStrategy } from './strategies/google-admin.strategy';
import { FacebookAdminStrategy } from './strategies/facebook-admin.strategy';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ session: false }),
    HttpModule.register({ timeout: 900000, maxRedirects: 5 }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, GoogleStrategy, FacebookStrategy, GoogleAdminStrategy, FacebookAdminStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}