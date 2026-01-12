import { reactConfig } from '@my-time/eslint-config';
import globals from 'globals';

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  {
    ignores: [
      'dist/**',
      'dev-dist/**',
      'node_modules/**',
      'coverage/**',
      'eslint.config.js',
      'tailwind.config.js',
      'postcss.config.cjs',
      '.daisyui/**',
    ],
  },
  ...reactConfig,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    // Add specific overrides or additional plugins here if needed
    // e.g. tailwindcss
  },
];
