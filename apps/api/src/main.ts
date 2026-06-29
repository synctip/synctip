import { initSentry } from './sentry';
initSentry();

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { toNodeHandler } from 'better-auth/node';
import type { NextFunction, Request, Response } from 'express';
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

  // Mount Better-Auth at /auth/*.
  //
  // We register it as a plain middleware (no Express path matching) and
  // dispatch by hand on the URL prefix. Two pitfalls this avoids:
  //
  //  1. `app.use('/auth', handler)` rewrites `req.url` to strip the
  //     mount prefix. Better-Auth's internal router then sees
  //     `/get-session` instead of `/auth/get-session`, fails its
  //     `basePath` check, and 404s every route.
  //
  //  2. `app.all('/auth/*splat', handler)` on Nest 11 + Express 5 +
  //     path-to-regexp v8 registers without error but never matches
  //     (likely a Nest-vs-Express router interaction).
  //
  // Note: `AUTH_BASE_URL` must point at the API origin (e.g.
  // `http://localhost:3000/auth`), NOT the web origin. Better-Auth
  // compares the incoming request URL's origin against the configured
  // `baseURL` and silently 404s on a mismatch.
  const authHandler = toNodeHandler(auth);
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.url === '/auth' || req.url.startsWith('/auth/')) {
      return authHandler(req, res);
    }
    return next();
  });

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
