import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: null,
      includeAssets: ["icons/liftwise-icon.svg"],
      manifest: {
        name: "Liftwise",
        short_name: "Liftwise",
        description: "A local-first workout log with explainable training insights.",
        start_url: "./",
        scope: "./",
        display: "standalone",
        background_color: "#f4f1e9",
        theme_color: "#151713",
        icons: [
          {
            src: "icons/liftwise-icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{html,js,css,svg}"],
        navigateFallback: "index.html",
      },
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        legacy: fileURLToPath(new URL("./index.html", import.meta.url)),
        modern: fileURLToPath(new URL("./modern.html", import.meta.url)),
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: process.env.LIFTWISE_API_ORIGIN ?? "http://127.0.0.1:3001",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.{js,ts,tsx}"],
    setupFiles: ["test/setup.ts"],
    env: {
      LIFTWISE_DB_PATH: ":memory:",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/domain.js",
        "src/domain/**/*.ts",
        "src/infrastructure/**/*.ts",
        "src/ui/**/*.{js,ts,tsx}",
      ],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 85,
        lines: 85,
      },
    },
  },
});
