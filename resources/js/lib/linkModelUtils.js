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

// Token kondisional ":cond ? :whenTrue | :whenFalse" -- dievaluasi SEBELUM
// substitusi token biasa. Dipakai model yang barisnya bisa merujuk salah satu
// dari dua relasi tergantung kolom lain (mis. SalesOrderItem:
// ":asset_id ? :asset | :item" -- render Asset jika baris ini aset (asset_id
// terisi), else ItemVariant). `|` pemisah whenTrue/whenFalse -- tanpanya
// ":asset:item" berdempet dan susah dibaca mana cabang mana.
//
// Nested ternary butuh tanda kurung EKSPLISIT di cabang yang mau di-nest, mis.
// ":c1 ? :a | (:c2 ? :b | :c)". Tanpa kurung, whenTrue/whenFalse HARUS token
// tunggal ":field" -- pola datar (non-nested) yang sudah ada sebelumnya tetap
// jalan tanpa ubahan. Ini regex tunggal TIDAK BISA menangani nesting dengan
// benar (satu match rakus akan salah baca ":c2" sbg value literal, bukan
// kondisi ternary lain) -- makanya dipakai parser rekursif kecil, bukan regex.
//
// Sengaja TIDAK butuh perubahan di parser lain (ModelController::templateLinkColumns,
// DataTableColumnSelector::templateLinkPlaceholders, search __invoke) -- ketiganya
// cuma regex ekstrak SETIAP token ":field" dari string mentah, dan cond/whenTrue/
// whenFalse di sini semua tetap ditulis dengan prefix ":" masing2 sehingga otomatis
// terekstrak sbg kolom/relasi nyata terpisah tanpa kode tambahan (spasi, `|`, `(`, `)`
// bukan bagian dari `\w`, jadi tidak mengganggu batas token di regex lain itu).
const IDENT_RE = /^[\w.]+/;

function isWhitespace(char) {
  return char != null && /\s/.test(char);
}

function skipWs(str, pos) {
  while (pos < str.length && isWhitespace(str[pos])) pos++;
  return pos;
}

function parseIdentToken(str, pos) {
  if (str[pos] !== ":") return null;
  const m = str.slice(pos + 1).match(IDENT_RE);
  if (!m) return null;
  return { ident: m[0], end: pos + 1 + m[0].length };
}

// Branch: "(" ternary ")" (nested, wajib kurung) ATAU ":field" (token polos).
function parseBranch(str, pos) {
  if (str[pos] === "(") {
    const inner = parseTernary(str, pos + 1);
    if (!inner) return null;
    const closeAt = skipWs(str, inner.end);
    if (str[closeAt] !== ")") return null;
    return { node: inner, end: closeAt + 1 };
  }
  const tok = parseIdentToken(str, pos);
  if (!tok) return null;
  return { node: tok.ident, end: tok.end };
}

// Parse ":cond ? branch | branch" mulai dari posisi ':' pembuka kondisi.
// Return null jika bukan pola valid di posisi ini (caller lalu treat sbg teks biasa).
function parseTernary(str, pos) {
  const condTok = parseIdentToken(str, pos);
  if (!condTok) return null;

  let p = skipWs(str, condTok.end);
  if (str[p] !== "?") return null;
  p = skipWs(str, p + 1);

  const whenTrue = parseBranch(str, p);
  if (!whenTrue) return null;
  p = skipWs(str, whenTrue.end);
  if (str[p] !== "|") return null;
  p = skipWs(str, p + 1);

  const whenFalse = parseBranch(str, p);
  if (!whenFalse) return null;

  return {
    cond: condTok.ident,
    whenTrue: whenTrue.node,
    whenFalse: whenFalse.node,
    end: whenFalse.end,
  };
}

function evalTernaryNode(node, value) {
  if (typeof node === "string") return node; // ":field" polos, tidak dieval lebih lanjut di sini
  const condValue = getValueObject(value, node.cond);
  return evalTernaryNode(condValue ? node.whenTrue : node.whenFalse, value);
}

export function resolveTernaryTokens(template, value) {
  let result = "";
  let i = 0;
  while (i < template.length) {
    if (template[i] === ":") {
      const parsed = parseTernary(template, i);
      if (parsed) {
        result += `:${evalTernaryNode(parsed, value)}`;
        i = parsed.end;
        continue;
      }
    }
    result += template[i];
    i++;
  }
  return result;
}

export const convertTemplateLink = (value, search, asObject = false) => {
  if (!value) return "";
  const template = resolveTernaryTokens(value.templateLink ?? "", value);
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
