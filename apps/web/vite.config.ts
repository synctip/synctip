import path from "node:path";
import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // Bind to all interfaces so the Cloudflare Tunnel and LAN devices can
    // reach the dev server. Vite still listens on localhost:5173 too.
    host: true,
    // Vite blocks unknown Host headers by default to prevent DNS rebinding.
    // Allow our Cloudflare Tunnel hostname so https://dev.synctip.com works.
    allowedHosts: ["dev.synctip.com"],
  },
});
