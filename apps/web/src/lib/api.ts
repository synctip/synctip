import { createApiClient } from "@synctip/api-client";

/**
 * Singleton API client for the web app.
 *
 * Reads VITE_API_URL at build time. Defaults to "" (relative URLs),
 * which are forwarded to the NestJS server by the Vite dev proxy
 * (see vite.config.ts). In production set this to the absolute API
 * origin, e.g. `https://api.synctip.com`.
 */
export const api = createApiClient({
  baseUrl: import.meta.env.VITE_API_URL ?? "",
});
