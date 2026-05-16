import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig(({ mode }) => ({
  root: "src/ui",
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: "../ui-dist",
    emptyOutDir: true,
    target: "es2020",
  },
  // Dev mode: proxy /ws → daemon so the browser SPA served by Vite
  // can still reach the daemon WebSocket at its own port.
  server: {
    proxy: {
      "/ws": {
        target: `ws://localhost:${process.env.VOICE_PORT ?? "3000"}`,
        ws: true,
      },
    },
  },
  define: {
    // Injected at build time so the SPA knows the WS URL in production.
    // In dev, Vite's proxy makes /ws work from the Vite origin.
    __VOICE_PORT__: JSON.stringify(process.env.VOICE_PORT ?? "3000"),
  },
}));
