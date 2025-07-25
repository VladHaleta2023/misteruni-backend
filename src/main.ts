import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import * as http from 'http';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const server = app.getHttpServer();
  const httpServer: http.Server = server;
  httpServer.setTimeout(120 * 1000);

  const configService = app.get(ConfigService);
  const port = configService.get<number>("PORT");

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  app.enableCors({
    origin: ['http://localhost:3000'],
    methods: 'GET, HEAD, PUT, PATCH, POST, DELETE',
    credentials: true,
  });

  await app.listen(port ?? 4000);
  console.log(`🚀 Server running on port: ${port}`);
}

void bootstrap();