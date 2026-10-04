import { getValueObject, isNullOrWhitespace } from "./utils";

/**
 * @param {object|null} value opsi yang divalidasi (membawa `thisModel`)
 * @param {string|string[]|null} model satu model, atau daftar model yang diizinkan
 *   (LinkModel multi-model: main + sub). Falsy / array kosong = skip validasi.
 * @returns {boolean}
 */
export function validate(value, model) {
  if (!value || !model) return true;
  if (Array.isArray(model)) {
    return model.length === 0 || model.includes(value.thisModel);
  }
  return value.thisModel === model;
}

/**
 * Nilai cmdk baris opsi berprefiks indeks sumber -- id PO Item dan id
 * ItemVariant bisa sama, jadi tanpa prefiks sorotan/pilihan bisa bentrok.
 * Selalu string (cmdk men-treat `value` sbg string).
 * @param {number} index indeks sumber (0 = main)
 * @param {string|number} id
 * @returns {string}
 */
export const sourceValue = (index, id) => `${index}:${id}`;

/**
 * Kebalikan `sourceValue`. `null` bila bukan nilai baris sumber (mis. sentinel).
 * @param {unknown} value
 * @returns {{index: number, id: string}|null}
 */
export const parseSourceValue = (value) => {
  if (typeof value !== "string") return null;
  const match = /^(\d+):(.*)$/s.exec(value);

  return match ? { index: Number(match[1]), id: match[2] } : null;
};

/**
 * Normalisasi sumber dropdown LinkModel: `[main, ...subModels valid]`.
 * Sub tanpa `model`/`label` dan model duplikat diabaikan (+ peringatan).
 * `config` = objek sub apa adanya; `null` untuk main (props LinkModel dipakai).
 * @param {object} root0
 * @param {string} root0.model
 * @param {string} [root0.mainLabel] ada -> main dibungkus header
 * @param {Array<{model: string, label: string}>} [root0.subModels]
 * @param {(message: string) => void} [warn]
 * @returns {Array<{index: number, model: string, label?: string, isMain: boolean, wrapped: boolean, config: object|null}>}
 */
export function buildSources(
  { model, mainLabel, subModels } = {},
  warn = (message) => console.warn(message),
) {
  const sources = [
    {
      index: 0,
      model,
      label: mainLabel,
      isMain: true,
      wrapped: !!mainLabel,
      config: null,
    },
  ];
  const seen = new Set([model]);
  (subModels ?? []).forEach((sub) => {
    if (!sub?.model || !sub?.label) {
      warn("LinkModel subModels: `model` dan `label` wajib, entri diabaikan.");
      return;
    }
    if (seen.has(sub.model)) {
      warn(`LinkModel subModels: model duplikat diabaikan (${sub.model}).`);
      return;
    }
    seen.add(sub.model);
    sources.push({
      index: sources.length,
      model: sub.model,
      label: sub.label,
      isMain: false,
      wrapped: true,
      config: sub,
    });
  });

  return sources;
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
