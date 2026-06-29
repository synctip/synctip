import * as Sentry from '@sentry/node';

/**
 * Initialize Sentry as early as possible (before Nest boots) so it can capture
 * crashes during module loading. If SENTRY_DSN is unset (typical in local dev)
 * this is a no-op and the SDK stays inert.
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment:
      process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    release:
      process.env.RELEASE_ID ?? process.env.RENDER_GIT_COMMIT ?? undefined,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
  });
}
