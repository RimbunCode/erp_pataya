import {
  parseCssDeclarations,
  selectorMatchesComponentTokens,
  splitSelectorList,
} from "./cssUtils";

function normalizeSelectorMapEntries(selectorMap = {}) {
  return Object.entries(selectorMap).reduce((result, [selector, style]) => {
    const normalizedSelector = String(selector || "").trim();
    if (!normalizedSelector) {
      return result;
    }

    result[normalizedSelector] = style;
    return result;
  }, {});
}

export function resolveComponentPrimarySelector(component) {
  if (!component) {
    return "";
  }

  const componentId = String(
    component.getId?.() || component.get?.("id") || "",
  ).trim();
  if (componentId) {
    return `#${componentId}`;
  }

  const selectorsString = String(component.getSelectorsString?.() || "").trim();
  if (selectorsString) {
    return splitSelectorList(selectorsString)[0] || selectorsString;
  }

  return String(component.get?.("tagName") || "").trim();
}

export function normalizeCssInputToSelectorMap(cssText, primarySelector = "") {
  const rawText = String(cssText || "").trim();
  if (!rawText) {
    return {};
  }

  const hasRuleBlockSyntax = rawText.includes("{") || rawText.includes("}");
  if (hasRuleBlockSyntax) {
    return normalizeSelectorMapEntries(
      parseCssDeclarations(rawText, { mode: "selectorMap" }),
    );
  }

  const declarations = parseCssDeclarations(rawText, { mode: "declarations" });
  const normalizedPrimarySelector = String(primarySelector || "").trim();
  if (!normalizedPrimarySelector || !Object.keys(declarations).length) {
    return {};
  }

  return {
    [normalizedPrimarySelector]: declarations,
  };
}

const DEFAULT_PROTECTED_SELECTORS_BY_COMPONENT_TYPE = {
  gjsgrid: [".gjs-grid"],
  grid: [".gjs-grid"],
  gjssubgrid: [".gjs-subgrid"],
  subgrid: [".gjs-subgrid"],
};

export function resolveProtectedSelectorsForComponent(
  component,
  currentRules = [],
) {
  if (!component) {
    return new Set();
  }

  const componentType = String(
    component.getType?.() || component.get?.("type") || "",
  )
    .trim()
    .toLowerCase();

  const candidateSelectors = new Set(
    DEFAULT_PROTECTED_SELECTORS_BY_COMPONENT_TYPE[componentType] || [],
  );

  const classes = (component.getClasses?.() || [])
    .map((className) =>
      typeof className === "string"
        ? className
        : className?.get?.("name") || className?.id || String(className),
    )
    .map((className) => String(className || "").trim())
    .filter(Boolean);

  classes
    .filter((className) => className.startsWith("gjs-"))
    .forEach((className) => {
      candidateSelectors.add(`.${className}`);
    });

  const availableSelectors = new Set(
    (currentRules || [])
      .map((rule) => String(rule?.selectors || "").trim())
      .filter(Boolean),
  );

  return new Set(
    [...candidateSelectors].filter((selector) =>
      availableSelectors.has(selector),
    ),
  );
}

export function ensureComponentIdRuleFirst(cssRules = [], componentId = "") {
  if (!Array.isArray(cssRules)) {
    return [];
  }

  const normalizedComponentId = String(componentId || "").trim();
  if (!normalizedComponentId) {
    return [...cssRules];
  }

  const idToken = `#${normalizedComponentId}`;
  const hasIdSelector = cssRules.some((rule) =>
    selectorMatchesComponentTokens(rule?.selectors, [idToken]),
  );

  if (hasIdSelector) {
    return [...cssRules];
  }

  return [
    {
      selectors: idToken,
      style: {},
    },
    ...cssRules,
  ];
}

function hasNonEmptyStyleValue(value) {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim() !== "";
  }

  return true;
}

export function hasStyleDeclarations(style = {}) {
  if (typeof style !== "object" || style === null || Array.isArray(style)) {
    return false;
  }

  return Object.values(style).some(hasNonEmptyStyleValue);
}

export function stripEmptyStyleRules(cssRules = []) {
  if (!Array.isArray(cssRules)) {
    return [];
  }

  return cssRules.filter((rule) => {
    const selector = String(rule?.selectors || "").trim();
    if (!selector) {
      return false;
    }

    return hasStyleDeclarations(rule?.style || {});
  });
}

export function mergeProtectedSelectorStyles(
  nextSelectorMap = {},
  currentRules = [],
  protectedSelectors = new Set(),
) {
  if (
    typeof nextSelectorMap !== "object" ||
    nextSelectorMap === null ||
    Array.isArray(nextSelectorMap)
  ) {
    return {};
  }

  const currentStyleBySelector = Object.fromEntries(
    (currentRules || [])
      .map((rule) => [String(rule?.selectors || "").trim(), rule?.style || {}])
      .filter(([selector]) => Boolean(selector)),
  );

  return Object.entries(nextSelectorMap).reduce((result, [selector, style]) => {
    const normalizedSelector = String(selector || "").trim();
    if (!normalizedSelector) {
      return result;
    }

    const incomingStyle =
      typeof style === "object" && style !== null && !Array.isArray(style)
        ? style
        : {};

    if (!protectedSelectors.has(normalizedSelector)) {
      result[normalizedSelector] = incomingStyle;
      return result;
    }

    const existingStyle = currentStyleBySelector[normalizedSelector];
    if (!hasStyleDeclarations(existingStyle)) {
      result[normalizedSelector] = incomingStyle;
      return result;
    }

    result[normalizedSelector] = {
      ...existingStyle,
      ...incomingStyle,
    };
    return result;
  }, {});
}

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findProtectedSelectorsInCssText(
  cssText = "",
  protectedSelectors = [],
) {
  const normalizedProtectedSelectors = [
    ...new Set(
      (Array.isArray(protectedSelectors) ? protectedSelectors : [])
        .map((selector) => String(selector || "").trim())
        .filter(Boolean),
    ),
  ];

  if (!normalizedProtectedSelectors.length) {
    return [];
  }

  const selectorMap = normalizeCssInputToSelectorMap(cssText);
  const matchedSelectors = new Set();

  Object.keys(selectorMap).forEach((selector) => {
    normalizedProtectedSelectors.forEach((protectedSelector) => {
      if (
        selectorMatchesComponentTokens(selector, [protectedSelector]) &&
        !matchedSelectors.has(protectedSelector)
      ) {
        matchedSelectors.add(protectedSelector);
      }
    });
  });

  const rawCssText = String(cssText || "");
  normalizedProtectedSelectors.forEach((protectedSelector) => {
    if (matchedSelectors.has(protectedSelector)) {
      return;
    }

    const selectorPattern = new RegExp(
      `(^|[^a-zA-Z0-9_-])${escapeRegExp(protectedSelector)}(?![a-zA-Z0-9_-])`,
    );

    if (selectorPattern.test(rawCssText)) {
      matchedSelectors.add(protectedSelector);
    }
  });

  return [...matchedSelectors];
}
