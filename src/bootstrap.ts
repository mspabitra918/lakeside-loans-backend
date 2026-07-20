import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Express } from 'express';
import { AppModule } from './app.module';

// Shared by the long-running server (main.ts) and the Vercel serverless
// handler (serverless.ts), so both apply the same prefix, pipes and CORS.
// Pass an Express instance to mount onto it; omit it to let Nest create one.
export async function createApp(
  expressApp?: Express,
): Promise<NestExpressApplication> {
  const app = expressApp
    ? await NestFactory.create<NestExpressApplication>(
        AppModule,
        new ExpressAdapter(expressApp),
      )
    : await NestFactory.create<NestExpressApplication>(AppModule);

  // Needed for @Ip() to resolve the real client behind a load balancer, which
  // the TCPA consent record depends on being accurate.
  app.set('trust proxy', 1);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      // Reject unknown keys outright rather than stripping them silently, so a
      // client sending fields the API does not model fails loudly.
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({ origin: origins, methods: ['GET', 'POST'] });

  return app;
}
