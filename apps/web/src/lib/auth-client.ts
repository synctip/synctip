import { createAuthClient } from "better-auth/react";
import { phoneNumberClient } from "better-auth/client/plugins";

/**
 * Better-Auth React client.
 *
 * The web app talks to the API cross-origin in every environment, so
 * `VITE_AUTH_BASE_URL` should be set to the absolute auth URL, e.g.
 *   - `http://localhost:3000/auth` for plain localhost dev
 *   - `https://api-dev.synctip.com/auth` for Cloudflare Tunnel dev
 *   - `https://api.synctip.com/auth` for production
 *
 * The `<current origin>/auth` fallback only exists so a missing env
 * var fails loudly with a network error against the web origin instead
 * of silently breaking auth.
 */
const baseURL =
  import.meta.env.VITE_AUTH_BASE_URL ??
  (typeof window !== "undefined"
    ? `${window.location.origin}/auth`
    : "http://localhost:3000/auth");

export const authClient = createAuthClient({
  baseURL,
  plugins: [phoneNumberClient()],
});

export const { useSession, signIn, signOut, signUp } = authClient;
