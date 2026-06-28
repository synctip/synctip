import { initSentry } from './sentry';
initSentry();

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Comma-separated list of allowed origins, e.g.
  //   WEB_ORIGIN=https://synctip.com,https://www.synctip.com
  // In dev the Vite proxy makes requests same-origin so CORS isn't hit.
  const origins =
    process.env.WEB_ORIGIN?.split(',')
      .map((o) => o.trim())
      .filter(Boolean) ?? [];

  app.enableCors({
    origin: origins.length > 0 ? origins : false,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
