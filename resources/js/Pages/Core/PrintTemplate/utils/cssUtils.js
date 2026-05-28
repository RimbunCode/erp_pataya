/**
 * CSS Declaration Parsing and Merging Utilities
 *
 * Provides functions for parsing, validating, merging, and cleaning up
 * CSS declarations used in the Print Template Editor's manual CSS feature.
 * @module cssUtils
 */

/**
 * Convert CSS property names to kebab-case.
 *
 * Handles:
 * - camelCase: `backgroundColor` -> `background-color`
 * - PascalCase vendor-like props: `WebkitTransform` -> `-webkit-transform`
 * - Existing kebab/underscore styles are normalized to lowercase kebab-case
 * @param {string} property - Raw CSS property name
 * @returns {string} Normalized kebab-case CSS property name
 */
export function toKebabCase(property = "") {
  if (typeof property !== "string" || !property.trim()) {
    return "";
  }

  const trimmedProperty = property.trim();

  if (trimmedProperty.includes("-") || trimmedProperty.includes("_")) {
    return trimmedProperty.replace(/_/g, "-").toLowerCase();
  }

  const kebabCore = trimmedProperty
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();

  const shouldPrefixVendorDash =
    /^[A-Z]/.test(trimmedProperty) &&
    /[A-Z]/.test(trimmedProperty.slice(1)) &&
    /[a-z]/.test(trimmedProperty);

  if (shouldPrefixVendorDash) {
    return `-${kebabCore}`;
  }

  return kebabCore;
}

function parseDeclarationEntries(cssText = "") {
  return String(cssText || "")
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean);
}

function parseDeclarationObject(cssText = "") {
  return parseDeclarationEntries(cssText).reduce((result, declaration) => {
    const separatorIndex = declaration.indexOf(":");
    if (separatorIndex < 1) {
      return result;
    }

    const property = toKebabCase(declaration.slice(0, separatorIndex));
    const value = declaration.slice(separatorIndex + 1).trim();

    if (!property || !value) {
      return result;
    }

    result[property] = value;
    return result;
  }, {});
}

function parseRuleBlocks(cssText = "") {
  const rules = [];
  const source = String(cssText || "");
  let cursor = 0;

  while (cursor < source.length) {
    while (cursor < source.length && /\s/.test(source[cursor])) {
      cursor += 1;
    }

    if (cursor >= source.length) {
      break;
    }

    const openBraceIndex = source.indexOf("{", cursor);
    if (openBraceIndex === -1) {
      return {
        rules,
        error: {
          declaration: source.slice(cursor).trim(),
          reason: "missing_brace",
        },
      };
    }

    const selector = source.slice(cursor, openBraceIndex).trim();
    if (!selector) {
      return {
        rules,
        error: {
          declaration: source.slice(cursor, openBraceIndex + 1).trim(),
          reason: "invalid_selector",
        },
      };
    }

    let depth = 1;
    let pointer = openBraceIndex + 1;

    while (pointer < source.length && depth > 0) {
      if (source[pointer] === "{") {
        depth += 1;
      } else if (source[pointer] === "}") {
        depth -= 1;
      }
      pointer += 1;
    }

    if (depth !== 0) {
      return {
        rules,
        error: {
          declaration: source.slice(cursor).trim(),
          reason: "missing_brace",
        },
      };
    }

    rules.push({
      selector,
      declarations: source.slice(openBraceIndex + 1, pointer - 1).trim(),
    });

    cursor = pointer;
  }

  return { rules, error: null };
}

function isValidSelector(selector = "") {
  const normalizedSelector = String(selector || "").trim();
  if (!normalizedSelector) {
    return false;
  }

  if (/[{};]/.test(normalizedSelector)) {
    return false;
  }

  if (normalizedSelector.startsWith("@")) {
    return false;
  }

  if (/[,>+~]\s*$/.test(normalizedSelector)) {
    return false;
  }

  const selectorWithoutPseudoElements = normalizedSelector
    .replace(/::[-_a-zA-Z][-_a-zA-Z0-9-]*(\([^)]*\))?/g, "")
    .trim();

  if (selectorWithoutPseudoElements) {
    try {
      if (
        typeof document !== "undefined" &&
        typeof document.createDocumentFragment === "function"
      ) {
        document
          .createDocumentFragment()
          .querySelector(selectorWithoutPseudoElements);
        return true;
      }
    } catch {
      // Fallback to permissive syntax validation below.
    }
  }

  return /^[\w\-*.#:[\]()="'\s>+~|^$,%/\\]+$/.test(normalizedSelector);
}

/**
 * @typedef {Record<string, string>} CssDeclarationMap
 */

/**
 * @typedef {Record<string, CssDeclarationMap>} CssSelectorMap
 */

/**
 * Parse CSS text into declarations or selector-based JSON object.
 *
 * Accepts input in the format: `property: value; property2: value2;`
 * Handles edge cases like extra whitespace, trailing semicolons, and
 * values containing colons (e.g., `background: url(http://example.com)`).
 * Supports selector blocks in this format: `selector { property: value; }`.
 * @param {string} cssText - Raw CSS declaration text or full CSS rule blocks
 * @param {{ mode?: "auto"|"declarations"|"selectorMap" }} [options]
 * @returns {CssDeclarationMap|CssSelectorMap}
 * @example
 * parseCssDeclarations("color: red; font-size: 12px;")
 * // => { "color": "red", "font-size": "12px" }
 * @example
 * parseCssDeclarations("body{background-color:red;color:black} #c123{margin:2px;color:black}")
 * // => { "body": { "background-color": "red", "color": "black" }, "#c123": { "margin": "2px", "color": "black" } }
 * @example
 * parseCssDeclarations("#invoice { color: red; }", { mode: "declarations" })
 * // => { "color": "red" }
 * @example
 * parseCssDeclarations("background: url(http://example.com);")
 * // => { "background": "url(http://example.com)" }
 */
export function parseCssDeclarations(cssText = "", options = {}) {
  if (typeof cssText !== "string" || !cssText.trim()) {
    return {};
  }

  const mode = options?.mode ?? "auto";
  const shouldParseAsRuleBlock = cssText.includes("{") || cssText.includes("}");

  if (!shouldParseAsRuleBlock) {
    return parseDeclarationObject(cssText);
  }

  const { rules } = parseRuleBlocks(cssText);
  const shouldReturnSelectorMap = mode === "selectorMap" || mode === "auto";

  if (!shouldReturnSelectorMap) {
    return rules.reduce((result, rule) => {
      return {
        ...result,
        ...parseDeclarationObject(rule.declarations),
      };
    }, {});
  }

  return rules.reduce((result, rule) => {
    const selector = rule.selector.trim();
    if (!selector) {
      return result;
    }

    result[selector] = {
      ...(result[selector] || {}),
      ...parseDeclarationObject(rule.declarations),
    };

    return result;
  }, {});
}

function isDeclarationMap(value = {}) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every(
    (entry) => typeof entry === "string" || entry instanceof String,
  );
}

function flattenSelectorMap(value = {}) {
  if (isDeclarationMap(value)) {
    return { ...value };
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  return Object.values(value).reduce((result, entry) => {
    if (!isDeclarationMap(entry)) {
      return result;
    }

    return {
      ...result,
      ...entry,
    };
  }, {});
}

/**
 * Serialize a style object back to CSS declaration text.
 * @param {Record<string, string>} styleObject - Object mapping CSS properties to values
 * @returns {string} Semicolon-separated CSS declaration string
 * @example
 * serializeCssDeclarations({ "color": "red", "font-size": "12px" })
 * // => "color: red; font-size: 12px;"
 */
export function serializeCssDeclarations(styleObject = {}) {
  return Object.entries(styleObject)
    .filter(
      ([key, value]) =>
        key && value !== null && value !== undefined && value !== "",
    )
    .map(([property, value]) => `${property}: ${value};`)
    .join(" ");
}

/**
 * @typedef {object} CssValidationError
 * @property {number} index - Zero-based index of the invalid declaration
 * @property {string} declaration - The raw declaration text that failed validation
 * @property {"missing_colon"|"missing_value"|"missing_property"|"invalid_selector"|"missing_brace"} reason - Type of validation error
 */

/**
 * @typedef {object} CssValidationResult
 * @property {boolean} isValid - Whether all declarations are valid
 * @property {CssValidationError[]} errors - Array of validation errors found
 * @property {Record<string, string>} validDeclarations - Successfully parsed declarations
 */

/**
 * Validate CSS declaration text for syntax errors.
 *
 * Detects:
 * - Missing colons (e.g., "color red")
 * - Missing values (e.g., "color:")
 * - Missing property names (e.g., ": red")
 * @param {string} cssText - Raw CSS declaration text to validate
 * @returns {CssValidationResult} Validation result with errors and valid declarations
 * @example
 * validateCssDeclarations("color: red; font-size")
 * // => { isValid: false, errors: [{ index: 1, declaration: "font-size", reason: "missing_colon" }], validDeclarations: { "color": "red" } }
 */
export function validateCssDeclarations(cssText = "") {
  if (typeof cssText !== "string" || !cssText.trim()) {
    return { isValid: true, errors: [], validDeclarations: {} };
  }

  const errors = [];
  const validDeclarations = {};
  let declarationIndex = 0;

  const validateEntries = (declarationsText) => {
    parseDeclarationEntries(declarationsText).forEach((declaration) => {
      const separatorIndex = declaration.indexOf(":");

      if (separatorIndex === -1) {
        errors.push({
          index: declarationIndex,
          declaration,
          reason: "missing_colon",
        });
        declarationIndex += 1;
        return;
      }

      const property = toKebabCase(declaration.slice(0, separatorIndex));
      const value = declaration.slice(separatorIndex + 1).trim();

      if (!property) {
        errors.push({
          index: declarationIndex,
          declaration,
          reason: "missing_property",
        });
        declarationIndex += 1;
        return;
      }

      if (!value) {
        errors.push({
          index: declarationIndex,
          declaration,
          reason: "missing_value",
        });
        declarationIndex += 1;
        return;
      }

      validDeclarations[property] = value;
      declarationIndex += 1;
    });
  };

  const shouldParseAsRuleBlock = cssText.includes("{") || cssText.includes("}");

  if (!shouldParseAsRuleBlock) {
    validateEntries(cssText);
    return {
      isValid: errors.length === 0,
      errors,
      validDeclarations,
    };
  }

  const { rules, error } = parseRuleBlocks(cssText);

  if (error) {
    errors.push({
      index: 0,
      declaration: error.declaration,
      reason: error.reason,
    });
  }

  rules.forEach((rule, ruleIndex) => {
    if (!isValidSelector(rule.selector)) {
      errors.push({
        index: ruleIndex,
        declaration: rule.selector,
        reason: "invalid_selector",
      });
    }

    validateEntries(rule.declarations);
  });

  return {
    isValid: errors.length === 0,
    errors,
    validDeclarations,
  };
}

/**
 * Merge visual panel styles with manual CSS declarations.
 *
 * Manual CSS takes precedence for overlapping properties. Non-overlapping
 * properties from both sources are preserved in the output.
 * @param {Record<string, string>} visualStyles - Styles from the visual style panel
 * @param {string|Record<string, string>} manualCss - Manual CSS as text or pre-parsed object
 * @returns {Record<string, string>} Merged style object
 * @example
 * mergeCssStyles({ color: "blue", margin: "10px" }, "color: red; padding: 5px;")
 * // => { color: "red", margin: "10px", padding: "5px" }
 */
export function mergeCssStyles(visualStyles = {}, manualCss = "") {
  const parsedManual =
    typeof manualCss === "string"
      ? parseCssDeclarations(manualCss, { mode: "declarations" })
      : manualCss || {};

  const normalizedManualStyles = flattenSelectorMap(parsedManual);

  return {
    ...visualStyles,
    ...normalizedManualStyles,
  };
}

/**
 * Remove only manual CSS properties from a combined style object,
 * preserving all visual panel styles.
 * @param {Record<string, string>} combinedStyles - The current combined style object
 * @param {string[]} manualCssKeys - Array of property names that were applied via manual CSS
 * @returns {Record<string, string>} Style object with manual CSS properties removed
 * @example
 * cleanupManualCss(
 *   { color: "red", margin: "10px", padding: "5px" },
 *   ["color", "padding"]
 * )
 * // => { margin: "10px" }
 */
export function cleanupManualCss(combinedStyles = {}, manualCssKeys = []) {
  if (!Array.isArray(manualCssKeys) || manualCssKeys.length === 0) {
    return { ...combinedStyles };
  }

  const keysToRemove = new Set(
    manualCssKeys.map((key) => key.trim().toLowerCase()),
  );

  return Object.fromEntries(
    Object.entries(combinedStyles).filter(
      ([key]) => !keysToRemove.has(key.trim().toLowerCase()),
    ),
  );
}

/**
 * Prevent double-wrapping of CSS in `body{}` when saving CSS on the body node.
 *
 * If the input CSS already contains a `body { ... }` wrapper, it extracts the
 * content without adding another wrapper. Handles multiple `body{}` blocks and
 * nested scenarios to ensure the output never contains `body{body{...}}`.
 * @param {string} cssText - CSS text that may or may not contain body wrappers
 * @returns {string} Clean CSS text without nested body wrappers
 * @example
 * preventBodyDoubleWrap("body { color: red; }")
 * // => "color: red;"
 * @example
 * preventBodyDoubleWrap("body { body { color: red; } }")
 * // => "color: red;"
 * @example
 * preventBodyDoubleWrap("color: red; font-size: 12px;")
 * // => "color: red; font-size: 12px;"
 */
export function preventBodyDoubleWrap(cssText = "") {
  if (typeof cssText !== "string" || !cssText.trim()) {
    return "";
  }

  let result = cssText.trim();

  // Repeatedly unwrap body{...} until no more body wrappers exist
  // This handles body{body{...}} and deeper nesting
  const bodyWrapperRegex = /^\s*body\s*\{([\s\S]*)\}\s*$/i;

  let maxIterations = 10; // Safety limit to prevent infinite loops
  while (bodyWrapperRegex.test(result) && maxIterations > 0) {
    result = result.replace(bodyWrapperRegex, "$1").trim();
    maxIterations--;
  }

  return result;
}

/**
 * Meng-escape karakter spesial regex agar string dapat digunakan sebagai pola literal di RegExp.
 * Karakter yang di-escape: . * + ? ^ $ { } ( ) | [ ] \
 * @param {string} value - String yang akan di-escape
 * @returns {string} String dengan karakter regex spesial yang sudah di-escape
 */
export function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Split selector list by top-level comma.
 *
 * Handles commas inside quotes, attribute selectors, and pseudo-class params.
 * @param {string} selectorText
 * @returns {string[]}
 */
export function splitSelectorList(selectorText = "") {
  const source = String(selectorText || "");
  if (!source.trim()) {
    return [];
  }

  const result = [];
  let current = "";
  let bracketDepth = 0;
  let parenDepth = 0;
  let singleQuoteOpen = false;
  let doubleQuoteOpen = false;
  let escaped = false;

  for (const char of source) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      current += char;
      escaped = true;
      continue;
    }

    if (char === "'" && !doubleQuoteOpen) {
      singleQuoteOpen = !singleQuoteOpen;
      current += char;
      continue;
    }

    if (char === '"' && !singleQuoteOpen) {
      doubleQuoteOpen = !doubleQuoteOpen;
      current += char;
      continue;
    }

    if (!singleQuoteOpen && !doubleQuoteOpen) {
      if (char === "[") {
        bracketDepth += 1;
      } else if (char === "]" && bracketDepth > 0) {
        bracketDepth -= 1;
      } else if (char === "(") {
        parenDepth += 1;
      } else if (char === ")" && parenDepth > 0) {
        parenDepth -= 1;
      } else if (char === "," && bracketDepth === 0 && parenDepth === 0) {
        const normalized = current.trim();
        if (normalized) {
          result.push(normalized);
        }
        current = "";
        continue;
      }
    }

    current += char;
  }

  const normalized = current.trim();
  if (normalized) {
    result.push(normalized);
  }

  return result;
}

function normalizeComponentClassNames(classes = []) {
  if (!Array.isArray(classes)) {
    return [];
  }

  return classes
    .map((className) => String(className || "").trim())
    .filter(Boolean);
}

function normalizeComponentAttributes(attributes = {}) {
  if (typeof attributes !== "object" || attributes === null) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(attributes)
      .map(([key, value]) => [String(key || "").trim(), value])
      .filter(([key]) => Boolean(key)),
  );
}

function normalizeSelectorToken(token = "") {
  return String(token || "").trim();
}

/**
 * Build unique selector tokens from a component descriptor.
 *
 * Tokens include `tagName`, `.class`, `#id`, `[attr]`, and `[attr="value"]`.
 * @param {object} componentDescriptor
 * @param {string} [componentDescriptor.id]
 * @param {string} [componentDescriptor.tagName]
 * @param {string[]} [componentDescriptor.classes]
 * @param {Record<string, unknown>} [componentDescriptor.attributes]
 * @param {string} [componentDescriptor.selectorsString]
 * @returns {string[]}
 */
export function buildComponentSelectorTokens(componentDescriptor = {}) {
  if (typeof componentDescriptor !== "object" || componentDescriptor === null) {
    return [];
  }

  const tokens = new Set();
  const id = normalizeSelectorToken(componentDescriptor.id);
  const tagName = normalizeSelectorToken(componentDescriptor.tagName);
  const classes = normalizeComponentClassNames(componentDescriptor.classes);
  const attributes = normalizeComponentAttributes(
    componentDescriptor.attributes,
  );

  if (tagName) {
    tokens.add(tagName.toLowerCase());
  }

  if (id) {
    tokens.add(`#${id}`);
  }

  classes.forEach((className) => {
    tokens.add(`.${className}`);
  });

  Object.entries(attributes).forEach(([attributeName, rawValue]) => {
    if (attributeName === "id") {
      const attributeId = normalizeSelectorToken(rawValue);
      if (attributeId) {
        tokens.add(`#${attributeId}`);
      }
      return;
    }

    if (attributeName === "class") {
      String(rawValue || "")
        .split(/\s+/)
        .map((className) => className.trim())
        .filter(Boolean)
        .forEach((className) => {
          tokens.add(`.${className}`);
        });
      return;
    }

    tokens.add(`[${attributeName}]`);

    const value = normalizeSelectorToken(rawValue);
    if (!value) {
      return;
    }

    tokens.add(`[${attributeName}="${value}"]`);
    tokens.add(`[${attributeName}='${value}']`);
    tokens.add(`[${attributeName}=${value}]`);
  });

  splitSelectorList(componentDescriptor.selectorsString).forEach((selector) => {
    const normalizedSelector = normalizeSelectorToken(selector);
    if (normalizedSelector) {
      tokens.add(normalizedSelector);
    }
  });

  return [...tokens];
}

function selectorIncludesClassOrId(selector = "", token = "") {
  const escapedToken = escapeRegExp(token);
  const classOrIdPattern = new RegExp(
    `(^|[^a-zA-Z0-9_-])${escapedToken}(?![a-zA-Z0-9_-])`,
  );
  return classOrIdPattern.test(selector);
}

function selectorIncludesTagName(selector = "", tagName = "") {
  const escapedTagName = escapeRegExp(tagName.toLowerCase());
  const tagNamePattern = new RegExp(
    `(^|[^a-zA-Z0-9_-])${escapedTagName}(?![a-zA-Z0-9_-])`,
    "i",
  );
  return tagNamePattern.test(selector);
}

function extractAttributeName(attributeSelector = "") {
  const normalized = attributeSelector.trim();
  if (!normalized.startsWith("[") || !normalized.endsWith("]")) {
    return "";
  }

  const content = normalized.slice(1, -1).trim();
  if (!content) {
    return "";
  }

  const nameMatch = content.match(/^[^\s~|^$*!=]+/);
  return nameMatch ? nameMatch[0] : "";
}

function selectorIncludesAttribute(selector = "", attributeSelector = "") {
  const normalizedAttribute = attributeSelector.trim();
  if (!normalizedAttribute) {
    return false;
  }

  if (!normalizedAttribute.includes("=")) {
    const attributeName = extractAttributeName(normalizedAttribute);
    if (!attributeName) {
      return false;
    }
    const escapedAttributeName = escapeRegExp(attributeName);
    const attributePattern = new RegExp(
      `\\[\\s*${escapedAttributeName}(?:\\s*[~|^$*]?=|\\s*\\])`,
      "i",
    );
    return attributePattern.test(selector);
  }

  const escapedAttribute = escapeRegExp(normalizedAttribute);
  const directPattern = new RegExp(escapedAttribute, "i");
  return directPattern.test(selector);
}

/**
 * Check whether selector text contains a specific component token.
 * @param {string} selector
 * @param {string} componentToken
 * @returns {boolean}
 */
export function selectorIncludesComponentToken(
  selector = "",
  componentToken = "",
) {
  const normalizedSelector = String(selector || "").trim();
  const normalizedToken = normalizeSelectorToken(componentToken);

  if (!normalizedSelector || !normalizedToken) {
    return false;
  }

  if (normalizedSelector === normalizedToken) {
    return true;
  }

  if (normalizedToken.startsWith(".") || normalizedToken.startsWith("#")) {
    return selectorIncludesClassOrId(normalizedSelector, normalizedToken);
  }

  if (normalizedToken.startsWith("[") && normalizedToken.endsWith("]")) {
    return selectorIncludesAttribute(normalizedSelector, normalizedToken);
  }

  return selectorIncludesTagName(normalizedSelector, normalizedToken);
}

/**
 * Check selector list text against component selector tokens.
 * @param {string} selector
 * @param {string[]} componentTokens
 * @returns {boolean}
 */
export function selectorMatchesComponentTokens(
  selector = "",
  componentTokens = [],
) {
  const selectorList = splitSelectorList(selector);
  if (!selectorList.length || !Array.isArray(componentTokens)) {
    return false;
  }

  return selectorList.some((selectorItem) =>
    componentTokens.some((token) =>
      selectorIncludesComponentToken(selectorItem, token),
    ),
  );
}

/**
 * Filter CSS rules by component selector tokens.
 * @param {Array<{selectors: string, style: Record<string, string>}>} cssRules
 * @param {string[]} componentTokens
 * @returns {Array<{selectors: string, style: Record<string, string>}>}
 */
export function filterCssRulesByComponentTokens(
  cssRules = [],
  componentTokens = [],
) {
  if (!Array.isArray(cssRules) || !Array.isArray(componentTokens)) {
    return [];
  }

  return cssRules.filter((rule) =>
    selectorMatchesComponentTokens(rule?.selectors, componentTokens),
  );
}
