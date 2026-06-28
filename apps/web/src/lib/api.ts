import { createApiClient } from "@synctip/api-client";

/**
 * Singleton API client for the web app.
 *
 * Reads VITE_API_URL at build time; defaults to "/api", which is
 * proxied to the NestJS server by Vite in dev (see vite.config.ts).
 */
export const api = createApiClient({
  baseUrl: import.meta.env.VITE_API_URL ?? "/api",
});
