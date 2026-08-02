import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
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
  test: {
    environment: "node",
    include: ["test/**/*.test.js"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/domain.js", "src/ui/**/*.js"],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 85,
        lines: 85,
      },
    },
  },
});
