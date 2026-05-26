export const EMPTY_TIPTAP_DOC = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export function isTiptapDoc(value) {
  return (
    value &&
    typeof value === "object" &&
    value.type === "doc" &&
    Array.isArray(value.content)
  );
}

export function ensureTiptapDoc(value) {
  if (isTiptapDoc(value)) {
    return value;
  }

  if (typeof value === "string") {
    return textToTiptapDoc(value);
  }

  return EMPTY_TIPTAP_DOC;
}

export function textToTiptapDoc(value) {
  const raw = typeof value === "string" ? value : "";
  const lines = raw.split(/\r\n|\r|\n/);

  if (lines.length === 0) {
    return EMPTY_TIPTAP_DOC;
  }

  return {
    type: "doc",
    content: lines.map((line) => {
      if (!line.trim()) {
        return { type: "paragraph" };
      }

      return {
        type: "paragraph",
        content: [{ type: "text", text: line }],
      };
    }),
  };
}

function nodeToText(node) {
  if (!node || typeof node !== "object") {
    return "";
  }

  if (node.type === "text") {
    return typeof node.text === "string" ? node.text : "";
  }

  if (node.type === "hardBreak") {
    return "\n";
  }

  if (!Array.isArray(node.content)) {
    return "";
  }

  return node.content.map(nodeToText).join("");
}

export function docToPlainText(doc) {
  const safeDoc = ensureTiptapDoc(doc);

  return safeDoc.content
    .map((childNode) => nodeToText(childNode))
    .join("\n")
    .trim();
}

export function docToLines(doc) {
  const text = docToPlainText(doc);
  if (!text) {
    return [];
  }

  return text
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
