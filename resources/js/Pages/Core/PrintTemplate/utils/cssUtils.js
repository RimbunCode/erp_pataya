/**
 * CSS Declaration Parsing and Merging Utilities
 *
 * Provides functions for parsing, validating, merging, and cleaning up
 * CSS declarations used in the Print Template Editor's manual CSS feature.
 * @module cssUtils
 */

/**
 * Parse semicolon-separated CSS declarations into a key-value object.
 *
 * Accepts input in the format: `property: value; property2: value2;`
 * Handles edge cases like extra whitespace, trailing semicolons, and
 * values containing colons (e.g., `background: url(http://example.com)`).
 * @param {string} cssText - Raw CSS declaration text (without selectors or braces)
 * @returns {Record<string, string>} Object mapping CSS property names to their values
 * @example
 * parseCssDeclarations("color: red; font-size: 12px;")
 * // => { "color": "red", "font-size": "12px" }
 * @example
 * parseCssDeclarations("background: url(http://example.com);")
 * // => { "background": "url(http://example.com)" }
 */
export function parseCssDeclarations(cssText = "") {
  if (typeof cssText !== "string" || !cssText.trim()) {
    return {};
  }

  return cssText
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .reduce((result, declaration) => {
      const separatorIndex = declaration.indexOf(":");
      if (separatorIndex < 1) {
        return result;
      }

      const property = declaration
        .slice(0, separatorIndex)
        .trim()
        .toLowerCase();
      const value = declaration.slice(separatorIndex + 1).trim();

      if (!property || !value) {
        return result;
      }

      result[property] = value;
      return result;
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
 * @property {"missing_colon"|"missing_value"|"missing_property"} reason - Type of validation error
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

  const declarations = cssText
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean);

  const errors = [];
  const validDeclarations = {};

  declarations.forEach((declaration, index) => {
    const separatorIndex = declaration.indexOf(":");

    if (separatorIndex === -1) {
      errors.push({
        index,
        declaration,
        reason: "missing_colon",
      });
      return;
    }

    const property = declaration.slice(0, separatorIndex).trim().toLowerCase();
    const value = declaration.slice(separatorIndex + 1).trim();

    if (!property) {
      errors.push({
        index,
        declaration,
        reason: "missing_property",
      });
      return;
    }

    if (!value) {
      errors.push({
        index,
        declaration,
        reason: "missing_value",
      });
      return;
    }

    validDeclarations[property] = value;
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
      ? parseCssDeclarations(manualCss)
      : manualCss || {};

  return {
    ...visualStyles,
    ...parsedManual,
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
