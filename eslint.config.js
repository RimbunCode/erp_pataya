import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "url";
import fs from "fs";
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

const importableExtensions = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"];

function resolveWithActualCase(targetPath) {
  const normalizedPath = path.resolve(targetPath);
  const { root } = path.parse(normalizedPath);
  const segments = normalizedPath
    .slice(root.length)
    .split(path.sep)
    .filter(Boolean);

  let currentPath = root;
  const actualSegments = [];

  for (const segment of segments) {
    if (!fs.existsSync(currentPath)) {
      return null;
    }

    const entries = fs.readdirSync(currentPath);
    const exactMatch = entries.find((entry) => entry === segment);
    const caseInsensitiveMatch =
      exactMatch ??
      entries.find((entry) => entry.toLowerCase() === segment.toLowerCase());

    if (!caseInsensitiveMatch) {
      return null;
    }

    actualSegments.push(caseInsensitiveMatch);
    currentPath = path.join(currentPath, caseInsensitiveMatch);
  }

  return path.join(root, ...actualSegments);
}

function stripKnownExtension(importPath) {
  for (const extension of importableExtensions) {
    if (importPath.endsWith(extension)) {
      return importPath.slice(0, -extension.length);
    }
  }

  return importPath;
}

function resolveImportTarget(importValue, sourceFilePath) {
  let importBasePath = null;

  if (importValue.startsWith("@/")) {
    importBasePath = path.join(__dirname, "resources/js", importValue.slice(2));
  } else if (importValue.startsWith("./") || importValue.startsWith("../")) {
    importBasePath = path.resolve(path.dirname(sourceFilePath), importValue);
  } else {
    return null;
  }

  const candidates = [importBasePath];

  for (const extension of importableExtensions) {
    candidates.push(`${importBasePath}${extension}`);
    candidates.push(path.join(importBasePath, `index${extension}`));
  }

  for (const candidatePath of candidates) {
    const actualPath = resolveWithActualCase(candidatePath);
    if (!actualPath) {
      continue;
    }

    if (fs.existsSync(actualPath) && fs.statSync(actualPath).isFile()) {
      return { candidatePath, actualPath };
    }
  }

  return null;
}

function toCanonicalImportPath(importValue, actualPath, sourceFilePath) {
  const hasExtension = /\.[a-z0-9]+$/i.test(importValue);

  if (importValue.startsWith("@/")) {
    const relativePath = path
      .relative(path.join(__dirname, "resources/js"), actualPath)
      .split(path.sep)
      .join("/");

    const aliasPath = `@/${relativePath}`;
    return hasExtension ? aliasPath : stripKnownExtension(aliasPath);
  }

  const relativePath = path
    .relative(path.dirname(sourceFilePath), actualPath)
    .split(path.sep)
    .join("/");
  const normalizedRelativePath = relativePath.startsWith(".")
    ? relativePath
    : `./${relativePath}`;

  return hasExtension
    ? normalizedRelativePath
    : stripKnownExtension(normalizedRelativePath);
}

const caseSensitiveImportPathsRule = {
  meta: {
    type: "problem",
    fixable: "code",
    docs: {
      description: "disallow import paths that mismatch actual file casing",
    },
    schema: [],
  },
  create(context) {
    const sourceFilePath = context.filename ?? context.getFilename();

    if (sourceFilePath === "<input>") {
      return {};
    }

    function checkImportSource(sourceNode) {
      if (!sourceNode || typeof sourceNode.value !== "string") {
        return;
      }

      const importValue = sourceNode.value;
      const resolvedTarget = resolveImportTarget(importValue, sourceFilePath);

      if (!resolvedTarget) {
        return;
      }

      const normalizedCandidatePath = path.resolve(
        resolvedTarget.candidatePath,
      );
      const normalizedActualPath = path.resolve(resolvedTarget.actualPath);

      if (normalizedCandidatePath === normalizedActualPath) {
        return;
      }

      const expectedImportPath = toCanonicalImportPath(
        importValue,
        resolvedTarget.actualPath,
        sourceFilePath,
      );

      if (expectedImportPath === importValue) {
        return;
      }

      const sourceCode = context.sourceCode ?? context.getSourceCode();
      const rawSourceText = sourceCode.getText(sourceNode);
      const quote =
        rawSourceText.startsWith("'") || rawSourceText.startsWith('"')
          ? rawSourceText[0]
          : '"';

      context.report({
        node: sourceNode,
        message: `Import path casing mismatch. Use "${expectedImportPath}".`,
        fix(fixer) {
          return fixer.replaceText(
            sourceNode,
            `${quote}${expectedImportPath}${quote}`,
          );
        },
      });
    }

    return {
      ImportDeclaration(node) {
        checkImportSource(node.source);
      },
      ExportNamedDeclaration(node) {
        checkImportSource(node.source);
      },
      ExportAllDeclaration(node) {
        checkImportSource(node.source);
      },
      ImportExpression(node) {
        if (node.source?.type === "Literal") {
          checkImportSource(node.source);
        }
      },
    };
  },
};

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
      local: {
        rules: {
          "case-sensitive-import-paths": caseSensitiveImportPathsRule,
        },
      },
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
      "local/case-sensitive-import-paths": "error",

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
