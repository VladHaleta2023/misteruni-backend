import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import * as http from 'http';
import * as cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const server = app.getHttpServer();
  const httpServer: http.Server = server;
  httpServer.setTimeout(900000);
  httpServer.keepAliveTimeout = 900000;
  httpServer.headersTimeout = 900000;

  const configService = app.get(ConfigService);
  const port = process.env.PORT || configService.get<number>('PORT') || 5000;

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://misteruni-frontend-admin.vercel.app',
      'https://misteruni-frontend-client.vercel.app',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  app.use(cookieParser());

  await app.listen(port);
  console.log(`🚀 Server running on port: ${port}`);
}

void bootstrap();