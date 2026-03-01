import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { Response } from 'express';
import * as bcrypt from 'bcryptjs';
import { LoginDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';
import { User, UserRole } from '@prisma/client';
import { OAuthLoginDto } from './dto/oauth-login.dto';

@Injectable()
export class AuthService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService
    ) {}

    async register(registerDto: RegisterDto, res: Response) {
        try {
            if (registerDto.password !== registerDto.confirmPassword) {
                throw new BadRequestException("Hasła nie są zgodne");
            }

            const existingEmail = await this.prismaService.user.findUnique({
                where: { email: registerDto.email },
            });
            if (existingEmail) throw new BadRequestException("Email jest już zajęty");

            const existingUsername = await this.prismaService.user.findUnique({
                where: { username: registerDto.username },
            });
            if (existingUsername) throw new BadRequestException("Nazwa użytkownika jest już zajęta");

            const passwordHash = await bcrypt.hash(registerDto.password, 10);

            const user = await this.prismaService.user.create({
                data: {
                    email: registerDto.email,
                    username: registerDto.username,
                    passwordHash,
                },
            });

            const token = this.jwtService.sign(
                { userId: user.id },
                { expiresIn: '1d' } 
            );

            res.cookie('accessToken', token, {
                httpOnly: true,
                secure: this.configService.get<string>("APP_ENV") === 'production',
                sameSite: this.configService.get<string>("APP_ENV") === 'production' ? 'none' : 'lax',
                maxAge: 24 * 60 * 60 * 1000,
            });

            return {
                statusCode: 201,
                message: 'Rejestracja zakończona pomyślnie',
            };
        } catch (error) {
            if (error instanceof BadRequestException) throw error;
            throw new InternalServerErrorException('Wystąpił błąd podczas rejestracji');
        }
    }

    async login(loginDto: LoginDto, res: Response) {
        try {
            const { login, password } = loginDto;

            const user = await this.prismaService.user.findFirst({
                where: {
                    OR: [
                        { email: login },
                        { username: login },
                    ],
                },
            });

            if (!user) {
                throw new BadRequestException('Nieprawidłowy login lub hasło');
            }

            if (!user.passwordHash) {
                throw new BadRequestException(
                    'Ten użytkownik loguje się tylko przez Google lub Facebook. Użyj odpowiedniej opcji logowania.'
                );
            }

            const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

            if (!isPasswordValid) {
                throw new BadRequestException('Nieprawidłowy login lub hasło');
            }

            const token = this.jwtService.sign(
                { userId: user.id },
                { expiresIn: '1d' }
            );

            res.cookie('accessToken', token, {
                httpOnly: true,
                secure: this.configService.get<string>("APP_ENV") === 'production',
                sameSite: this.configService.get<string>("APP_ENV") === 'production' ? 'none' : 'lax',
                maxAge: 24 * 60 * 60 * 1000,
            });

            return {
                statusCode: 200,
                message: 'Zalogowano pomyślnie',
            };
        } catch (error) {
            if (error instanceof BadRequestException) throw error;
            throw new InternalServerErrorException('Wystąpił błąd podczas logowania');
        }
    }

    async loginAdmin(loginDto: LoginDto, res: Response) {
        try {
            const { login, password } = loginDto;

            const user = await this.prismaService.user.findFirst({
                where: {
                    OR: [
                        { email: login },
                        { username: login },
                    ],
                },
            });

            if (!user) {
                throw new BadRequestException('Nieprawidłowy login lub hasło');
            }

            if (!user.passwordHash) {
                throw new BadRequestException(
                    'Ten użytkownik loguje się tylko przez Google lub Facebook. Użyj odpowiedniej opcji logowania.'
                );
            }

            const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        
            if (!isPasswordValid) {
                throw new BadRequestException('Nieprawidłowy login lub hasło');
            }

            if (user.role !== 'ADMIN') {
                throw new BadRequestException('Brak uprawnień administracyjnych');
            }

            const token = this.jwtService.sign(
                { userId: user.id },
                { expiresIn: '1d' }
            );

            res.cookie('accessToken', token, {
                httpOnly: true,
                secure: this.configService.get<string>("APP_ENV") === 'production',
                sameSite: this.configService.get<string>("APP_ENV") === 'production' ? 'none' : 'lax',
                maxAge: 24 * 60 * 60 * 1000,
            });

            return {
                statusCode: 200,
                message: 'Zalogowano pomyślnie jako administrator',
            };
        } catch (error) {
            if (error instanceof BadRequestException) throw error;
            throw new InternalServerErrorException('Wystąpił błąd podczas logowania administracyjnego');
        }
    }

    async oAuthLogin(oAuthDto: OAuthLoginDto, res: Response) {
        try {
            const { provider, providerId, email, username } = oAuthDto;

            if (!providerId) {
                throw new BadRequestException('Brak identyfikatora użytkownika od dostawcy OAuth.');
            }

            if (!email && !username) {
                throw new BadRequestException('Dostawca OAuth nie przekazał ani email, ani nazwy użytkownika.');
            }

            const authProvider = await this.prismaService.userAuthProvider.findUnique({
                where: { provider_providerId: { provider, providerId } },
                include: { user: true },
            });

            let user: User | undefined;

            if (!authProvider) {
                if (email) {
                    const existingUser = await this.prismaService.user.findUnique({ where: { email } });
                    if (existingUser) user = existingUser;
                }

                if (!user) {
                    try {
                        user = await this.prismaService.user.create({
                            data: {
                                email: email || null,
                                username: username || null,
                                role: UserRole.USER,
                            },
                        });
                    } catch (err) {
                        throw new BadRequestException('Nie udało się utworzyć użytkownika OAuth. Sprawdź dane.');
                    }
                }

                try {
                    await this.prismaService.userAuthProvider.create({
                        data: {
                            provider,
                            providerId,
                            email: email || null,
                            userId: user.id,
                        },
                    });
                } catch (err) {
                    throw new BadRequestException('Nie udało się powiązać użytkownika z dostawcą OAuth.');
                }
            } else {
                user = authProvider.user;
            }

            if (!user) {
                throw new BadRequestException('Nie udało się zidentyfikować użytkownika OAuth.');
            }

            const token = this.jwtService.sign({ userId: user.id }, { expiresIn: '1d' });

            res.cookie('accessToken', token, {
                httpOnly: true,
                secure: this.configService.get<string>('APP_ENV') === 'production',
                sameSite: this.configService.get<string>('APP_ENV') === 'production' ? 'none' : 'lax',
                maxAge: 24 * 60 * 60 * 1000,
            });

            return {
                statusCode: 200,
                message: 'Zalogowano pomyślnie'
            };
        } catch (error) {
            if (error instanceof BadRequestException) throw error;
            throw new InternalServerErrorException('Wystąpił błąd podczas logowania OAuth');
        }
    }

    async oAuthLoginAdmin(oAuthDto: OAuthLoginDto, res: Response) {
        try {
            const { provider, providerId, email } = oAuthDto;

            if (!providerId) {
                throw new BadRequestException('Brak identyfikatora użytkownika od dostawcy OAuth.');
            }

            if (!email) {
                throw new BadRequestException('Dostawca OAuth nie przekazał email użytkownika.');
            }

            const authProvider = await this.prismaService.userAuthProvider.findUnique({
                where: { provider_providerId: { provider, providerId } },
                include: { user: true },
            });

            let user: User | undefined;

            if (authProvider) {
                user = authProvider.user;
            } else {
                const existingUser = await this.prismaService.user.findUnique({ where: { email } });
                if (!existingUser) {
                    throw new BadRequestException('Nie znaleziono użytkownika administracyjnego w bazie danych.');
                }
                user = existingUser;

                const providerLink = await this.prismaService.userAuthProvider.findUnique({
                    where: { provider_providerId: { provider, providerId } },
                });

                if (!providerLink) {
                    await this.prismaService.userAuthProvider.create({
                        data: {
                            provider,
                            providerId,
                            email,
                            userId: user.id,
                        },
                    });
                }
            }

            if (user.role !== 'ADMIN') {
                throw new BadRequestException('Brak uprawnień administracyjnych');
            }

            const token = this.jwtService.sign({ userId: user.id }, { expiresIn: '1d' });

            res.cookie('accessToken', token, {
                httpOnly: true,
                secure: this.configService.get<string>('APP_ENV') === 'production',
                sameSite: this.configService.get<string>('APP_ENV') === 'production' ? 'none' : 'lax',
                maxAge: 24 * 60 * 60 * 1000,
            });

            return {
                statusCode: 200,
                message: 'Zalogowano pomyślnie jako administrator',
            };
        } catch (error) {
            if (error instanceof BadRequestException) throw error;
            throw new InternalServerErrorException('Wystąpił błąd podczas logowania OAuth administracyjnego');
        }
    }

    async logout(res: Response) {
        try {
            res.clearCookie('accessToken', {
                httpOnly: true,
                secure: this.configService.get<string>('APP_ENV') === 'production',
                sameSite: this.configService.get<string>('APP_ENV') === 'production' ? 'none' : 'lax',
            });

            return {
                statusCode: 200,
                message: 'Wylogowano pomyślnie',
            };
        } catch (error) {
            throw new InternalServerErrorException('Wystąpił błąd podczas wylogowania');
        }
    }

    async checkAuth() {
        try {
            return {
                statusCode: 200,
                message: 'Użytkownik jest zalogowany',
            };
        } catch (error) {
            return {
                statusCode: 500,
                message: 'Wystąpił błąd podczas sprawdzania użytkownika',
            };
        }
    }
}
