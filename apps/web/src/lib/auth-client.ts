import { createAuthClient } from "better-auth/react";
import { phoneNumberClient } from "better-auth/client/plugins";

/**
 * Better-Auth React client.
 *
 * The default baseURL is `<current origin>/auth`, which works in dev
 * (Vite proxy forwards `/auth/*` to the API) and in any single-origin
 * deploy.
 *
 * For cross-origin deploys (e.g. web and api on different subdomains),
 * set `VITE_AUTH_BASE_URL` to the absolute API auth URL, e.g.
 *   VITE_AUTH_BASE_URL=https://api.synctip.com/auth
 */
const baseURL =
  import.meta.env.VITE_AUTH_BASE_URL ??
  (typeof window !== "undefined"
    ? `${window.location.origin}/auth`
    : "http://localhost:5173/auth");

export const authClient = createAuthClient({
  baseURL,
  plugins: [phoneNumberClient()],
});

export const { useSession, signIn, signOut, signUp } = authClient;
