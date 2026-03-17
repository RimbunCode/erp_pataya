import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "url";
import globals from "globals";
import jsdoc from "eslint-plugin-jsdoc";
import path from "path";
import pluginJs from "@eslint/js";
import prettierPlugin from "eslint-plugin-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactPlugin from "eslint-plugin-react";
/** @type {import('eslint').Linter.Config[]} */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  {
    ignores: [
      "**/*.d.ts",
      "resources/js/Components/CurrencyInput/**",
      "resources/js/schema.ts",
      "resources/js/lib/google-diff.js",
    ],
  },
  {
    files: ["**/*.{js,mjs,cjs,jsx,ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        route: "readonly",
      },
    },
  },

  pluginJs.configs.recommended,
  jsdoc.configs["flat/recommended"],

  {
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooks,
      prettier: prettierPlugin,
      jsdoc,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },

  // Support config lama (eslint-config-node, prettier, dll)
  ...compat.config({
    env: { browser: true, es2021: true },
    extends: [
      "plugin:prettier/recommended",
      "plugin:react/recommended",
      "plugin:react-hooks/recommended",
    ],
    parserOptions: {
      ecmaFeatures: { jsx: true },
      ecmaVersion: 2024,
      sourceType: "module",
    },
    rules: {
      // Prettier
      "prettier/prettier": "warn",

      //React
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "react/jsx-filename-extension": [1, { extensions: [".js", ".jsx"] }],

      // Hooks
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/immutability": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",

      // General
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-empty": "warn",
      "no-useless-escape": "off",
      "linebreak-style": ["warn", "unix"],

      // JSDoc
      "jsdoc/require-jsdoc": "off",
      "jsdoc/require-param-description": "off",
      "jsdoc/require-returns-description": "off",
      "jsdoc/require-property-description": "off",
      "jsdoc/require-description": "off",
      "jsdoc/require-description-complete-sentence": "off",
    },
  }),
];
