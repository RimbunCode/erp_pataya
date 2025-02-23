import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "url";
import globals from "globals";
import path from "path";
import pluginJs from "@eslint/js";

/** @type {import('eslint').Linter.Config[]} */

// mimic CommonJS variables -- not needed if using CommonJS
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
});
export default [
  { files: ["**/*.{js,mjs,cjs,jsx}"] },
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  pluginJs.configs.recommended,
  ...compat.config({
    env: { browser: true, es2021: true },
    extends: [
      "plugin:react/recommended",
      "plugin:react-hooks/recommended",
      "plugin:prettier/recommended",
    ],
    plugins: ["react", "react-hooks", "prettier"],
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      "prettier/prettier": "warn",
      "react/prop-types": "off",
      "react/jsx-filename-extension": [
        1,
        { extensions: [".js", ".jsx", ".ts", ".tsx"] },
      ],
      "react/jsx-uses-react": "error",
      "react/jsx-uses-vars": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "off",
      "linebreak-style": ["error", "unix"],
      "react/react-in-jsx-scope": "off",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-empty": "warn",
      "no-useless-escape": "off",
    },
  }),
];
