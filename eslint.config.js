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

function collectScopes(scope, collectedScopes = []) {
  collectedScopes.push(scope);

  for (const childScope of scope.childScopes ?? []) {
    collectScopes(childScope, collectedScopes);
  }

  return collectedScopes;
}

function compileIgnorePattern(pattern) {
  if (!pattern) {
    return null;
  }

  try {
    return new RegExp(pattern, "u");
  } catch {
    return null;
  }
}

function collectBindingNamesFromPattern(pattern, bindingNames) {
  if (!pattern) {
    return;
  }

  if (pattern.type === "Identifier") {
    bindingNames.add(pattern.name);
    return;
  }

  if (pattern.type === "RestElement") {
    collectBindingNamesFromPattern(pattern.argument, bindingNames);
    return;
  }

  if (pattern.type === "AssignmentPattern") {
    collectBindingNamesFromPattern(pattern.left, bindingNames);
    return;
  }

  if (pattern.type === "ArrayPattern") {
    for (const element of pattern.elements) {
      collectBindingNamesFromPattern(element, bindingNames);
    }
    return;
  }

  if (pattern.type === "ObjectPattern") {
    for (const property of pattern.properties) {
      if (property.type === "RestElement") {
        collectBindingNamesFromPattern(property.argument, bindingNames);
        continue;
      }

      collectBindingNamesFromPattern(property.value, bindingNames);
    }
  }
}

function collectBindingNamesFromDeclaration(declaration, bindingNames) {
  if (!declaration) {
    return;
  }

  if (declaration.type === "VariableDeclaration") {
    for (const declarator of declaration.declarations) {
      collectBindingNamesFromPattern(declarator.id, bindingNames);
    }
    return;
  }

  if (
    declaration.type === "FunctionDeclaration" ||
    declaration.type === "ClassDeclaration"
  ) {
    if (declaration.id?.type === "Identifier") {
      bindingNames.add(declaration.id.name);
    }
  }
}

function collectExportedBindingNames(programNode) {
  const exportedBindingNames = new Set();

  for (const statement of programNode.body ?? []) {
    if (statement.type === "ExportNamedDeclaration") {
      collectBindingNamesFromDeclaration(
        statement.declaration,
        exportedBindingNames,
      );

      for (const specifier of statement.specifiers ?? []) {
        if (
          specifier.type === "ExportSpecifier" &&
          specifier.local?.type === "Identifier"
        ) {
          exportedBindingNames.add(specifier.local.name);
        }
      }

      continue;
    }

    if (statement.type === "ExportDefaultDeclaration") {
      if (statement.declaration?.type === "Identifier") {
        exportedBindingNames.add(statement.declaration.name);
      }

      if (
        statement.declaration?.type === "FunctionDeclaration" ||
        statement.declaration?.type === "ClassDeclaration"
      ) {
        if (statement.declaration.id?.type === "Identifier") {
          exportedBindingNames.add(statement.declaration.id.name);
        }
      }
    }
  }

  return exportedBindingNames;
}

function isInternalNamedExpressionBinding(variable) {
  return (
    variable.scope?.type === "function-expression-name" ||
    variable.scope?.type === "class-expression-name"
  );
}

function isVariableExported(variable, exportedBindingNames) {
  return exportedBindingNames.has(variable.name);
}

function buildImportStatement(
  importDeclaration,
  remainingSpecifiers,
  sourceCode,
) {
  const defaultSpecifier = remainingSpecifiers.find(
    (specifier) => specifier.type === "ImportDefaultSpecifier",
  );
  const namespaceSpecifier = remainingSpecifiers.find(
    (specifier) => specifier.type === "ImportNamespaceSpecifier",
  );
  const namedSpecifiers = remainingSpecifiers.filter(
    (specifier) => specifier.type === "ImportSpecifier",
  );
  const importClauseParts = [];

  if (defaultSpecifier) {
    importClauseParts.push(sourceCode.getText(defaultSpecifier));
  }

  if (namespaceSpecifier) {
    importClauseParts.push(sourceCode.getText(namespaceSpecifier));
  }

  if (namedSpecifiers.length) {
    const namedText = namedSpecifiers
      .map((specifier) => sourceCode.getText(specifier))
      .join(", ");
    importClauseParts.push(`{ ${namedText} }`);
  }

  if (!importClauseParts.length) {
    return null;
  }

  const importKeyword =
    importDeclaration.importKind === "type" ? "import type" : "import";
  const sourceText = sourceCode.getText(importDeclaration.source);
  const importDeclarationText = sourceCode.getText(importDeclaration);
  const sourceIndex = importDeclarationText.lastIndexOf(sourceText);
  const tailText =
    sourceIndex === -1
      ? ";"
      : importDeclarationText.slice(sourceIndex + sourceText.length);

  return `${importKeyword} ${importClauseParts.join(", ")} from ${sourceText}${tailText}`;
}

function buildUnusedImportFix(variable, sourceCode, fixer) {
  const importDefinition = variable.defs.find(
    (definition) => definition.type === "ImportBinding",
  );

  if (!importDefinition || !importDefinition.node?.parent) {
    return null;
  }

  const importSpecifier = importDefinition.node;
  const importDeclaration = importSpecifier.parent;

  if (importDeclaration.type !== "ImportDeclaration") {
    return null;
  }

  const remainingSpecifiers = importDeclaration.specifiers.filter(
    (specifier) => specifier !== importSpecifier,
  );

  if (!remainingSpecifiers.length) {
    return fixer.remove(importDeclaration);
  }

  const nextImportStatement = buildImportStatement(
    importDeclaration,
    remainingSpecifiers,
    sourceCode,
  );

  if (!nextImportStatement) {
    return fixer.remove(importDeclaration);
  }

  return fixer.replaceText(importDeclaration, nextImportStatement);
}

function buildUnusedVariablePrefixFix(variable, fixer) {
  const targetName = `_${variable.name}`;

  if (targetName === variable.name) {
    return null;
  }

  if (variable.scope?.set?.has(targetName)) {
    return null;
  }

  const nodesToRename = new Map();
  const addNode = (node) => {
    if (!node || node.type !== "Identifier") {
      return;
    }

    const rangeStart =
      node.range?.[0] ?? `${node.loc?.start?.line}:${node.loc?.start?.column}`;
    const rangeEnd =
      node.range?.[1] ?? `${node.loc?.end?.line}:${node.loc?.end?.column}`;
    const key = `${rangeStart}-${rangeEnd}`;

    nodesToRename.set(key, node);
  };

  for (const identifier of variable.identifiers) {
    addNode(identifier);
  }

  for (const reference of variable.references) {
    addNode(reference.identifier);
  }

  if (!nodesToRename.size) {
    return null;
  }

  return Array.from(nodesToRename.values()).map((node) =>
    fixer.replaceText(node, targetName),
  );
}

const noUnusedVarsFixerRule = {
  meta: {
    type: "problem",
    fixable: "code",
    docs: {
      description:
        "report unused vars, remove unused imports, and prefix unused vars with underscore",
    },
    schema: [
      {
        type: "object",
        properties: {
          argsIgnorePattern: { type: "string" },
          varsIgnorePattern: { type: "string" },
          caughtErrorsIgnorePattern: { type: "string" },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const [options = {}] = context.options;
    const argsIgnoreRegex = compileIgnorePattern(options.argsIgnorePattern);
    const varsIgnoreRegex = compileIgnorePattern(options.varsIgnorePattern);
    const caughtErrorsIgnoreRegex = compileIgnorePattern(
      options.caughtErrorsIgnorePattern,
    );
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    const exportedBindingNames = collectExportedBindingNames(sourceCode.ast);

    function shouldIgnoreVariable(variable) {
      if (variable.name === "arguments" || variable.eslintUsed) {
        return true;
      }

      if (isInternalNamedExpressionBinding(variable)) {
        return true;
      }

      if (isVariableExported(variable, exportedBindingNames)) {
        return true;
      }

      const definitionTypes = new Set(
        variable.defs.map((definition) => definition.type),
      );
      const ignoreRegex = definitionTypes.has("Parameter")
        ? argsIgnoreRegex
        : definitionTypes.has("CatchClause")
          ? caughtErrorsIgnoreRegex
          : varsIgnoreRegex;

      return ignoreRegex ? ignoreRegex.test(variable.name) : false;
    }

    function hasReadReference(variable) {
      return variable.references.some((reference) => reference.isRead());
    }

    return {
      "Program:exit"() {
        const globalScope = sourceCode.scopeManager?.globalScope;

        if (!globalScope) {
          return;
        }

        for (const scope of collectScopes(globalScope)) {
          for (const variable of scope.variables) {
            if (!variable.defs.length) {
              continue;
            }

            if (shouldIgnoreVariable(variable) || hasReadReference(variable)) {
              continue;
            }

            const reportNode =
              variable.identifiers[0] ?? variable.defs[0]?.name;

            if (!reportNode) {
              continue;
            }

            const isUnusedImport = variable.defs.every(
              (definition) => definition.type === "ImportBinding",
            );

            context.report({
              node: reportNode,
              message: isUnusedImport
                ? `Unused import "${variable.name}".`
                : `Unused variable "${variable.name}".`,
              fix: (fixer) =>
                isUnusedImport
                  ? buildUnusedImportFix(variable, sourceCode, fixer)
                  : buildUnusedVariablePrefixFix(variable, fixer),
            });
          }
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
          "no-unused-vars-fixer": noUnusedVarsFixerRule,
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
      // Semua rule react-hooks selain rules-of-hooks share satu compiler-grade
      // analysis pass (React Compiler HIR) — makan ~52% total waktu lint di
      // codebase ini (406 file). Matiin satu-satu gak nolong karena cost-nya
      // nempel ke rule react-hooks lain yang masih on; harus off semua.
      // Project ini belum pakai React Compiler jadi rule ini pure overhead.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/immutability": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
      "react-hooks/use-memo": "off",
      "react-hooks/void-use-memo": "off",
      "react-hooks/component-hook-factories": "off",
      "react-hooks/error-boundaries": "off",
      "react-hooks/set-state-in-render": "off",
      "react-hooks/config": "off",
      "react-hooks/gating": "off",
      "react-hooks/globals": "off",
      "react-hooks/incompatible-library": "off",
      "react-hooks/unsupported-syntax": "off",
      "react-hooks/refs": "off",

      // General
      "no-unused-vars": "off",
      "local/no-unused-vars-fixer": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
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
      // React & JSX dipakai luas di @returns JSDoc component tanpa perlu
      // `import React` eksplisit (automatic JSX runtime) — anggap valid.
      "jsdoc/no-undefined-types": [
        "warn",
        { definedTypes: ["React", "JSX"] },
      ],
    },
  }),
];
