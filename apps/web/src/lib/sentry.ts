import * as Sentry from "@sentry/react";

/**
 * Initialize Sentry as early as possible. If VITE_SENTRY_DSN is unset (typical
 * in local dev) this is a no-op and the SDK stays inert.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: Number(
      import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? "0.1",
    ),
  });
}
