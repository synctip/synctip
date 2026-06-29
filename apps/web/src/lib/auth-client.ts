import { createAuthClient } from "better-auth/react";
import { phoneNumberClient } from "better-auth/client/plugins";

/**
 * Better-Auth React client.
 *
 * The web app talks to the API cross-origin in every environment, so the
 * auth handler always lives on the API host, never on the web origin.
 *
 * Resolution order:
 *   1. `VITE_AUTH_BASE_URL` (explicit override — must end in `/auth`)
 *   2. `${VITE_API_URL}/auth` (derived, the common case)
 *   3. `http://localhost:3000/auth` (last-resort dev fallback)
 *
 * We deliberately do NOT fall back to `window.location.origin` — that
 * silently routes auth traffic at the web host (e.g. `dev.synctip.com`)
 * which has no auth handler and produces confusing 404s.
 */
function resolveAuthBaseUrl(): string {
  const explicit = import.meta.env.VITE_AUTH_BASE_URL;
  if (explicit) return explicit;

  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl) return `${apiUrl.replace(/\/+$/, "")}/auth`;

  return "http://localhost:3000/auth";
}

const baseURL = resolveAuthBaseUrl();

export const authClient = createAuthClient({
  baseURL,
  plugins: [phoneNumberClient()],
});

export const { useSession, signIn, signOut, signUp } = authClient;
