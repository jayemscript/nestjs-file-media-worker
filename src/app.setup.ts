import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Express } from 'express';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import dns from 'node:dns';

// Set DNS servers globally for c-ares resolution methods
dns.setServers(['1.1.1.1', '8.8.8.8']);

export function configureApplication(app: INestApplication): void {
  const configService = app.get(ConfigService);
  const expressApp = app.getHttpAdapter().getInstance() as Express;
  expressApp.set('trust proxy', 1);
  expressApp.disable('x-powered-by');
  expressApp.enable('strict routing');

  const allowedOrigins =
    configService.get<string>('CORS_ORIGINS')?.split(',').filter(Boolean) ?? [];
  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-App-Id',
      'X-Api-Key',
      'X-Admin-Key',
    ],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(app.get(Reflector)),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
}
