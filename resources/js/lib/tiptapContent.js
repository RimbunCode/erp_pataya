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

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nodeToHtml(node) {
  if (!node || typeof node !== "object") return "";

  if (node.type === "text") {
    let html = escapeHtml(typeof node.text === "string" ? node.text : "");
    if (Array.isArray(node.marks)) {
      node.marks.forEach((mark) => {
        if (mark.type === "bold") html = `<strong>${html}</strong>`;
        else if (mark.type === "italic") html = `<em>${html}</em>`;
        else if (mark.type === "underline") html = `<u>${html}</u>`;
        else if (mark.type === "strike") html = `<s>${html}</s>`;
        else if (mark.type === "link") {
          const href = escapeHtml(mark.attrs?.href ?? "");
          const target = mark.attrs?.target === "_blank" ? ' target="_blank" rel="noopener noreferrer"' : "";
          html = `<a href="${href}"${target}>${html}</a>`;
        }
      });
    }
    return html;
  }

  if (node.type === "hardBreak") return "<br>";

  const inner = Array.isArray(node.content)
    ? node.content.map(nodeToHtml).join("")
    : "";

  const align = node.attrs?.textAlign;
  const style = align && align !== "left" ? ` style="text-align:${align}"` : "";

  switch (node.type) {
    case "paragraph": return `<p${style}>${inner}</p>`;
    case "heading": {
      const level = node.attrs?.level ?? 2;
      return `<h${level}${style}>${inner}</h${level}>`;
    }
    case "bulletList": return `<ul>${inner}</ul>`;
    case "orderedList": return `<ol>${inner}</ol>`;
    case "listItem": return `<li>${inner}</li>`;
    case "blockquote": return `<blockquote>${inner}</blockquote>`;
    default: return inner;
  }
}

export function docToHtml(doc) {
  const safeDoc = ensureTiptapDoc(doc);
  return safeDoc.content.map(nodeToHtml).join("");
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
