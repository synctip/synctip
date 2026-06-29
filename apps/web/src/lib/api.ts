import { createApiClient } from "@synctip/api-client";

/**
 * Singleton API client for the web app.
 *
 * Reads VITE_API_URL at build time. The web app always talks to the API
 * cross-origin (no Vite proxy), so this should be set in every
 * environment, e.g.:
 *   - `http://localhost:3000` for plain localhost dev
 *   - `https://api-dev.synctip.com` for Cloudflare Tunnel dev
 *   - `https://api.synctip.com` for production
 *
 * Falling back to `""` would produce relative URLs that hit the web
 * origin and 404 — we keep the fallback only to keep the type narrow.
 */
export const api = createApiClient({
  baseUrl: import.meta.env.VITE_API_URL ?? "",
});
