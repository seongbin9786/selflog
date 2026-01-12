import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import react from "eslint-plugin-react";
import globals from "globals";
import tseslint from "typescript-eslint";
import { baseConfig } from "./base.js";

/**
 * React configuration extending base configuration.
 * Includes:
 * - Base config
 * - React recommended rules
 * - React Hooks rules
 * - React Refresh rules
 */
export const reactConfig = tseslint.config(...baseConfig, {
  files: ["**/*.{ts,tsx}"],
  plugins: {
    react,
    "react-hooks": reactHooks,
    "react-refresh": reactRefresh,
  },
  settings: {
    react: { version: "detect" },
  },
  rules: {
    ...react.configs.recommended.rules,
    ...react.configs["jsx-runtime"].rules,
    ...reactHooks.configs.recommended.rules,
    "react-refresh/only-export-components": [
      "warn",
      { allowConstantExport: true },
    ],
  },
  languageOptions: {
    globals: {
      ...globals.browser,
    },
  },
});
