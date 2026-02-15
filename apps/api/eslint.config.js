import { baseConfig } from "@my-time/eslint-config";
import globals from "globals";

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      ".serverless/**",
      "coverage/**",
      "eslint.config.js",
      "tsup.config.ts",
      "scripts/**",
      "jest.config.js",
    ],
  },
  ...baseConfig,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
