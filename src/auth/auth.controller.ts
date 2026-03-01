import { Controller, Post, Body, Res, UseGuards, Get, Req, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Response } from 'express';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  private readonly clientUrl: string | undefined;
  private readonly clientUrlAdmin: string | undefined;

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService
  ) {
    const node_env = this.configService.get<string>('APP_ENV') || 'development';

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