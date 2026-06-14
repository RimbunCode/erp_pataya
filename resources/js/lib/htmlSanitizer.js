import axios from "axios";

/**
 * Allowed HTML tags (whitelist) - matches backend HTMLSanitizerService
 */
const ALLOWED_TAGS = [
  "div",
  "span",
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "table",
  "tr",
  "td",
  "th",
  "ul",
  "ol",
  "li",
  "a",
  "img",
  "strong",
  "em",
  "br",
];

/**
 * Allowed HTML attributes (whitelist) - matches backend HTMLSanitizerService
 */
const ALLOWED_ATTRIBUTES = [
  "class",
  "id",
  "style",
  "href",
  "src",
  "alt",
  "title",
];

/**
 * Dangerous tags that should be blocked - matches backend HTMLSanitizerService
 */
const DANGEROUS_TAGS = [
  "script",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "button",
];

/**
 * Dangerous attribute patterns - matches backend HTMLSanitizerService
 */
const DANGEROUS_ATTRIBUTE_PATTERNS = [
  /^on\w+/i, // onclick, onerror, onload, etc.
  /javascript:/i, // javascript: protocol
];

/**
 * Validate URL for href and src attributes.
 * Matches backend isValidUrl() logic.
 * @param {string} url
 * @returns {boolean}
 */
function isValidUrl(url) {
  if (!url) {
    return true;
  }

  // Check for javascript: protocol
  if (/^\s*javascript:/i.test(url)) {
    return false;
  }

  // Check for data: protocol with script content
  if (/^\s*data:.*script/i.test(url)) {
    return false;
  }

  // Allow relative URLs, http, https, mailto, tel
  if (/^(https?:\/\/|mailto:|tel:|\/|\.\/|\.\.\/|#)/i.test(url)) {
    return true;
  }

  // Allow URLs without protocol (relative paths)
  if (!/^[a-z]+:/i.test(url)) {
    return true;
  }

  return false;
}

/**
 * Check if an attribute name matches any dangerous pattern.
 * @param {string} attrName
 * @returns {boolean}
 */
function isDangerousAttribute(attrName) {
  return DANGEROUS_ATTRIBUTE_PATTERNS.some((pattern) => pattern.test(attrName));
}

/**
 * Check if an attribute value matches any dangerous pattern.
 * @param {string} attrValue
 * @returns {boolean}
 */
function isDangerousAttributeValue(attrValue) {
  return DANGEROUS_ATTRIBUTE_PATTERNS.some((pattern) =>
    pattern.test(attrValue),
  );
}

/**
 * Client-side HTML sanitization matching backend HTMLSanitizerService rules.
 *
 * Uses a whitelist approach for tags and attributes, removes dangerous
 * event handlers and validates URLs in href/src attributes.
 * @param {string} html - Raw HTML content to sanitize
 * @returns {{ sanitizedHTML: string, warnings: string[], removedTags: string[], removedAttributes: string[] }}
 */
export function sanitizeHTML(html) {
  const removedTags = [];
  const removedAttributes = [];
  const warnings = [];

  if (!html || !html.trim()) {
    return {
      sanitizedHTML: "",
      warnings: [],
      removedTags: [],
      removedAttributes: [],
    };
  }

  // Parse HTML using DOMParser
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const wrapper = doc.body.firstChild;

  if (wrapper) {
    processNode(wrapper, removedTags, removedAttributes);
  }

  // Extract sanitized HTML from wrapper's children
  let sanitizedHTML = "";
  if (wrapper && wrapper.hasChildNodes()) {
    for (const child of wrapper.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        sanitizedHTML += child.textContent;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        sanitizedHTML += child.outerHTML;
      }
    }
  }

  // Generate warnings
  const uniqueRemovedTags = [...new Set(removedTags)];
  const uniqueRemovedAttributes = [...new Set(removedAttributes)];

  if (uniqueRemovedTags.length > 0) {
    warnings.push("Removed dangerous tags: " + uniqueRemovedTags.join(", "));
  }

  if (uniqueRemovedAttributes.length > 0) {
    warnings.push(
      "Removed dangerous attributes: " + uniqueRemovedAttributes.join(", "),
    );
  }

  return {
    sanitizedHTML,
    warnings,
    removedTags: uniqueRemovedTags,
    removedAttributes: uniqueRemovedAttributes,
  };
}

/**
 * Process a DOM node and its children recursively.
 * Removes dangerous tags and attributes from the node tree.
 * @param {Node} node
 * @param {string[]} removedTags
 * @param {string[]} removedAttributes
 */
function processNode(node, removedTags, removedAttributes) {
  if (!node) {
    return;
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const tagName = node.nodeName.toLowerCase();

    // Check if tag is dangerous or not allowed
    if (DANGEROUS_TAGS.includes(tagName) || !ALLOWED_TAGS.includes(tagName)) {
      removedTags.push(tagName);
      node.parentNode?.removeChild(node);
      return;
    }

    // Process attributes
    if (node.hasAttributes()) {
      const attributesToRemove = [];

      for (const attribute of node.attributes) {
        const attrName = attribute.name.toLowerCase();
        const attrValue = attribute.value;

        // Check if attribute is allowed
        if (!ALLOWED_ATTRIBUTES.includes(attrName)) {
          attributesToRemove.push(attrName);
          removedAttributes.push(attrName);
          continue;
        }

        // Check for dangerous attribute name patterns
        if (isDangerousAttribute(attrName)) {
          attributesToRemove.push(attrName);
          removedAttributes.push(attrName);
          continue;
        }

        // Check for dangerous attribute value patterns
        if (isDangerousAttributeValue(attrValue)) {
          attributesToRemove.push(attrName);
          removedAttributes.push(attrName);
          continue;
        }

        // Validate URLs in href and src attributes
        if (
          (attrName === "href" || attrName === "src") &&
          !isValidUrl(attrValue)
        ) {
          attributesToRemove.push(attrName);
          removedAttributes.push(attrName);
        }
      }

      // Remove dangerous attributes
      for (const attrName of attributesToRemove) {
        node.removeAttribute(attrName);
      }
    }
  }

  // Process child nodes (collect first to avoid mutation issues)
  if (node.hasChildNodes()) {
    const children = [...node.childNodes];
    for (const child of children) {
      processNode(child, removedTags, removedAttributes);
    }
  }
}

/**
 * Validate HTML by calling the backend `/api/html/sanitize` endpoint.
 *
 * This provides server-side validation to ensure the HTML is safe,
 * complementing the client-side sanitization.
 * @param {string} html - Raw HTML content to validate
 * @returns {Promise<{ sanitizedHTML: string, warnings: string[], removedTags: string[], removedAttributes: string[] }>}
 */
export async function sanitizeHTMLBackend(html) {
  if (!html || !html.trim()) {
    return {
      sanitizedHTML: "",
      warnings: [],
      removedTags: [],
      removedAttributes: [],
    };
  }

  const response = await axios.post("/api/html/sanitize", { html });

  return {
    sanitizedHTML: response.data.sanitizedHTML ?? "",
    warnings: response.data.warnings ?? [],
    removedTags: response.data.removedTags ?? [],
    removedAttributes: response.data.removedAttributes ?? [],
  };
}
