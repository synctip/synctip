import { initSentry } from './sentry';
initSentry();

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { toNodeHandler } from 'better-auth/node';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { auth } from './auth/auth';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Disable Nest's body parser so Better-Auth can read the raw request
    // body. We re-mount the body parser AFTER the auth handler below.
    bodyParser: false,
  });

  // Trust Render's reverse proxy so req.ip / X-Forwarded-* resolve correctly.
  app.set('trust proxy', 1);

  app.use(helmet());

  // Comma-separated list of allowed origins, e.g.
  //   WEB_ORIGIN=https://synctip.com,https://www.synctip.com
  // In dev the Vite proxy makes requests same-origin so CORS isn't hit.
  const origins =
    process.env.WEB_ORIGIN?.split(',')
      .map((o) => o.trim())
      .filter(Boolean) ?? [];

  // CORS must be registered BEFORE the Better-Auth handler so preflight and
  // ACAO headers are applied to /auth/* requests too.
  app.enableCors({
    origin: origins.length > 0 ? origins : false,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Mount Better-Auth at /auth/*. Better-Auth derives its internal route
  // prefix from `new URL(AUTH_BASE_URL).pathname`, so `AUTH_BASE_URL` must
  // end in `/auth` for this to match.
  app.use('/auth', toNodeHandler(auth));

  // Re-enable JSON / form body parsing for every other route.
  app.use(json());
  app.use(urlencoded({ extended: true }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
