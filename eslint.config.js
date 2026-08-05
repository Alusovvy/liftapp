import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "test-results/**",
      "playwright-report/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Browser-facing application code (both the modern TS app and the
    // pre-migration legacy scripts run only in the browser).
    files: ["src/**/*.{js,ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    // Node-context config files.
    files: [
      "vite.config.js",
      "playwright.config.ts",
      "eslint.config.js",
      "scripts/**/*.mjs",
      "server/**/*.ts",
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    // Vitest/Playwright specs run under jsdom/browser-like globals plus Node's.
    files: ["test/**/*.{js,ts,tsx}", "e2e/**/*.{js,ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ["src/**/*.{ts,tsx}", "test/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Pre-migration legacy scripts: keep linting on, but don't demand the
    // same strictness as the new TypeScript domain/feature code until they
    // are extracted (see REMAINING-WORK-SPEC.md P0.5).
    files: [
      "src/app.js",
      "src/domain.js",
      "src/main.js",
      "src/pwa.js",
      "src/ui/**/*.js",
      "test/**/*.js",
    ],
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: ["**/*.{js,jsx}"],
    ...tseslint.configs.disableTypeChecked,
  },
  prettier,
);
