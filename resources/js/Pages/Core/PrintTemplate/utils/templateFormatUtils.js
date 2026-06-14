function decodeTokenFromBase64(base64Token = "") {
  if (!base64Token) {
    return "";
  }

  try {
    if (typeof window !== "undefined" && typeof window.atob === "function") {
      const binary = window.atob(base64Token);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    }

    if (typeof atob === "function") {
      const binary = atob(base64Token);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    }

    if (typeof globalThis.Buffer !== "undefined") {
      return globalThis.Buffer.from(base64Token, "base64").toString("utf8");
    }
  } catch {
    return "";
  }

  return "";
}

function readAttributeValue(attributes = "", attributeName = "") {
  if (!attributes || !attributeName) {
    return "";
  }

  const escapedAttributeName = attributeName.replace(
    /[-/\\^$*+?.()|[\]{}]/g,
    "\\$&",
  );
  const pattern = new RegExp(
    `${escapedAttributeName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i",
  );
  const match = attributes.match(pattern);

  if (!match) {
    return "";
  }

  return match[1] || match[2] || match[3] || "";
}

function stripHtmlTags(content = "") {
  return String(content).replace(/<[^>]*>/g, "");
}

/**
 * Normalize inline variable token spans into plain Handlebar token text.
 *
 * This intentionally avoids parsing the full template via DOMParser because
 * parser reserialization can relocate non-HTML text nodes (e.g. `{{#each ...}}`)
 * outside table sections (`tbody`), which breaks exported Handlebar structure.
 * @param {string} template
 * @returns {string}
 */
function normalizeInlineVariableTokenSpans(template = "") {
  if (typeof template !== "string" || !template.trim()) {
    return "";
  }

  const inlineTokenSpanRegex =
    /<span\b([^>]*\bdata-variable-inline\b[^>]*)>([\s\S]*?)<\/span>/gi;

  return template.replace(
    inlineTokenSpanRegex,
    (_match, attributes, content) => {
      const dataToken = readAttributeValue(attributes, "data-token");
      if (dataToken) {
        return dataToken;
      }

      const dataTokenB64 = readAttributeValue(attributes, "data-token-b64");
      const decodedToken = decodeTokenFromBase64(dataTokenB64);
      if (decodedToken) {
        return decodedToken;
      }

      return stripHtmlTags(content);
    },
  );
}

function formatHandlebarTemplate(template = "") {
  if (typeof template !== "string" || !template.trim()) {
    return "";
  }

  const normalized = normalizeInlineVariableTokenSpans(template)
    .replace(/\{\{#(each|if|unless)([^}]*)\}\}/g, "\n$&\n")
    .replace(/\{\{\/(each|if|unless)\}\}/g, "\n$&\n")
    .replace(/\n{2,}/g, "\n");

  return normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

export {
  decodeTokenFromBase64,
  formatHandlebarTemplate,
  normalizeInlineVariableTokenSpans,
};
