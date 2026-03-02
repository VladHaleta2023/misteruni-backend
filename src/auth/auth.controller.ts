import { Controller, Post, Body, Res, UseGuards, Get, Req, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Response } from 'express';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { OAuthLoginDto } from './dto/oauth-login.dto';
import { OAuth2Client } from 'google-auth-library';

@Controller('auth')
export class AuthController {
  private readonly clientUrl: string | undefined;
  private readonly clientUrlAdmin: string | undefined;
  private googleClient: OAuth2Client;

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService
  ) {
    const node_env = this.configService.get<string>('APP_ENV') || 'development';
    this.googleClient = new OAuth2Client();

    if (node_env === 'development') {
        this.clientUrl = this.configService.get<string>('CLIENT_URL_LOCAL') || undefined;
        this.clientUrlAdmin = this.configService.get<string>('CLIENT_URL_ADMIN_LOCAL') || undefined;
    }
    else {
        this.clientUrl = this.configService.get<string>('CLIENT_URL') || undefined;
        this.clientUrlAdmin = this.configService.get<string>('CLIENT_URL_ADMIN') || undefined;
    }
  }

  @Post('register')
  async register(@Body() registerDto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    return this.authService.register(registerDto, res);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.authService.login(loginDto, res);
  }

  @Post('login-admin')
  async loginAdmin(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.authService.loginAdmin(loginDto, res);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(
    @Req() req,
    @Res({ passthrough: true }) res: Response
  ) {
    try {
      await this.authService.oAuthLogin(req.user, res);
      return res.redirect(`${this.clientUrl}/subjects`);
    }
    catch {
      return res.redirect(`${this.clientUrl}`);
    }
  }

  @Get('google/admin')
  @UseGuards(AuthGuard('google-admin'))
  googleAdminAuth() {}

  @Get('google/admin/callback')
  @UseGuards(AuthGuard('google-admin'))
  async googleAdminCallback(
    @Req() req,
    @Res({ passthrough: true }) res: Response
  ) {
    try {
      await this.authService.oAuthLoginAdmin(req.user, res);
      return res.redirect(`${this.clientUrlAdmin}/dashboard`);
    }
    catch {
      return res.redirect(`${this.clientUrlAdmin}`);
    }
  }

  @Post('mobile')
  async mobileAuth(
    @Body() dto: OAuthLoginDto & { idToken: string; platform: 'ANDROID' | 'IOS' },
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!dto.idToken) throw new BadRequestException('idToken is required');

    const ticket = await this.googleClient.verifyIdToken({
      idToken: dto.idToken,
      audience:
        dto.platform === 'ANDROID'
          ? this.configService.get<string>('GOOGLE_ANDROID_CLIENT_ID')
          : this.configService.get<string>('GOOGLE_IOS_CLIENT_ID')
    });

    const payload = ticket.getPayload();

    if (!payload?.sub) throw new BadRequestException('Invalid token');

    await this.authService.oAuthLogin(
      {
        provider: 'GOOGLE',
        providerId: payload.sub,
        email: payload.email,
        username: payload.name,
      },
      res,
    );

    return { status: 200, message: 'Zalogowano pomyślnie' };
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    return this.authService.logout(res);
  }

  @UseGuards(JwtAuthGuard)
  @Get('check')
  async checkAuth() {
    return await this.authService.checkAuth();
  }
}