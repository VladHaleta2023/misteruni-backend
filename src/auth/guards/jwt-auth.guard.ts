import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prismaService: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req: Request = context.switchToHttp().getRequest();
    const token = req.cookies?.accessToken;

    if (!token) {
      throw new UnauthorizedException('Nie znaleziono tokenu autoryzacyjnego.');
    }

    try {
      const payload = this.jwtService.verify(token);

      const user = await this.prismaService.user.findUnique({ where: { id: payload.userId } });

      if (!user) {
        throw new UnauthorizedException('Użytkownik nie istnieje.');
      }

      (req as any).user = user;

      return true;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError || err instanceof Prisma.PrismaClientUnknownRequestError) {
        throw new InternalServerErrorException('Błąd bazy danych');
      }

      if (err instanceof UnauthorizedException) {
        throw err;
      }

      throw new UnauthorizedException('Nieprawidłowy token.');
    }
  }
}