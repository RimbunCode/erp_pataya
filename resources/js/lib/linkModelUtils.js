import { getValueObject, isNullOrWhitespace } from "./utils";

export function validate(value, model) {
  if (!value || !model) return true;
  return value.thisModel === model;
}
// Satu sumber pasangan char<->entity -- escapeHtml dan unescapeHtml pakai list yg
// sama supaya keduanya selalu simetris (tambah karakter baru cukup di satu tempat).
const HTML_ENTITIES = [
  ["&", "&amp;"], // harus tetap paling awal saat escape, biar & hasil entity lain tidak ikut ke-escape ulang
  ["<", "&lt;"],
  [">", "&gt;"],
  ['"', "&quot;"],
  ["'", "&#39;"],
];

function escapeHtml(value) {
  return HTML_ENTITIES.reduce(
    (result, [char, entity]) => result.split(char).join(entity),
    String(value),
  );
}

function unescapeHtml(value) {
  return HTML_ENTITIES.reduce(
    (result, [char, entity]) => result.split(entity).join(char),
    String(value),
  );
}

export const convertTemplateLink = (value, search, asObject = false) => {
  if (!value) return "";
  const template = value.templateLink ?? "";
  let item = template.replace(/:((\w[\w]+{:[\w]+})|(\w[\w.]+))/g, (match) => {
    match = match.replace(/(.*?){:(.*?)}/i, ":$2");
    const newValue = getValueObject(value, match.substring(1));
    if (typeof newValue == "object" && newValue !== null) {
      if (newValue.templateLink) {
        return convertTemplateLink(newValue, search);
      }
      const firstVal = Object.values(newValue).find(
        (v) => typeof v === "string" || typeof v === "number",
      );
      return firstVal != null ? escapeHtml(firstVal) : match;
    }
    return newValue != null ? escapeHtml(newValue) : match;
  });
  if (!asObject && search == null) {
    const titleMatch = item.match(/<title(.*?)>(.*?)<\/title>/i);
    const plainTextMatch = item.match(/^[^<]+/g);

    return titleMatch
      ? unescapeHtml(titleMatch[2].trim())
      : plainTextMatch
        ? unescapeHtml(plainTextMatch[0].trim())
        : "";
  }

  item = item.replace(/<title(.*?)>(.*?)<\/title>/gi, "");

  let searchWords =
    search
      .split(/\s+/)
      ?.map((string) => string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .filter((x) => !isNullOrWhitespace(x)) || [];

  if (searchWords.length < 1) return item;

  let regex = new RegExp(`(${searchWords.join("|")})`, "gi");
  item = item.replace(/(<[^>]+>)|([^<]+)/g, (_, tag, text) => {
    if (tag) return tag; // Jika ini bagian dari tag HTML, jangan ubah
    return text.replace(regex, `<mark class="bg-yellow-500">$1</mark>`); // Hanya ubah teks biasa
  });

  return item;
};
