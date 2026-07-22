import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The FastAPI backend runs on :8010 — proxy /api and /health to it.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:8010", changeOrigin: true },
      "/health": { target: "http://localhost:8010", changeOrigin: true },
    },
  },
});
