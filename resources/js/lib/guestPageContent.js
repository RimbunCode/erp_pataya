import {
  docToLines,
  docToPlainText,
  ensureTiptapDoc,
} from "@/lib/tiptapContent";

function parsePath(path) {
  return String(path)
    .split(".")
    .map((segment) => (/^\d+$/.test(segment) ? Number(segment) : segment));
}

function getByPath(content, path) {
  return parsePath(path).reduce((currentValue, segment) => {
    if (currentValue == null) {
      return undefined;
    }

    return currentValue[segment];
  }, content);
}

export function getGuestImageUrl(content, path, fallbackUrl = "") {
  const value = getByPath(content, path);

  if (typeof value === "string" && value.trim() !== "") {
    return route("files.preview", value);
  }

  return fallbackUrl;
}

function normalizeFallbackText(fallback) {
  if (typeof fallback === "string") {
    return fallback;
  }

  if (Array.isArray(fallback)) {
    return fallback.join("\n");
  }

  return "";
}

export function getGuestDoc(content, path, fallback = "") {
  const value = getByPath(content, path);

  if (value != null) {
    return ensureTiptapDoc(value);
  }

  return ensureTiptapDoc(normalizeFallbackText(fallback));
}

export function getGuestText(content, path, fallback = "") {
  const text = docToPlainText(getGuestDoc(content, path, fallback));

  if (text) {
    return text;
  }

  return normalizeFallbackText(fallback);
}

export function getGuestLines(content, path, fallback = []) {
  const value = getByPath(content, path);

  if (Array.isArray(value)) {
    const itemLines = value.flatMap((item) =>
      docToLines(ensureTiptapDoc(item)),
    );

    if (itemLines.length > 0) {
      return itemLines;
    }
  }

  const lines = docToLines(getGuestDoc(content, path, fallback));

  if (lines.length > 0) {
    return lines;
  }

  if (Array.isArray(fallback)) {
    return fallback;
  }

  return normalizeFallbackText(fallback)
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
