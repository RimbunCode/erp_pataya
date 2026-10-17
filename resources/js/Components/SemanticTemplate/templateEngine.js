import { TZDate } from "@date-fns/tz";
import { format, formatDistance } from "date-fns";
import { formatNumber } from "@/Components/NumberInput/formatNumber";
import { getLocaleDate, getValueObject } from "@/lib/utils";
import { resolveTernaryTokens } from "@/lib/linkModelUtils";

/**
 * Engine murni untuk template tampilan sel (renderer bersama SemanticTemplate).
 *
 * Alur: ternary -> buang `<title>` -> normalisasi self-closing -> sanitasi
 * allowlist (`prepareTemplate`), lalu placeholder diisi nilai baris SETELAH
 * parsing (`fillPlaceholders`). Nilai data tidak pernah diparsing sebagai HTML.
 */

/** Tag semantik (dirender jadi komponen UI bersama). */
export const SEMANTIC_TAGS = [
  "muted",
  "stack",
  "inline",
  "badge",
  "status",
  "dot",
  "nav-link",
  "chips",
  "truncate",
  "progress",
  "icon",
  "avatar",
  "when",
  "mark",
];

/** HTML dasar yang diizinkan apa adanya. */
export const BASIC_TAGS = [
  "strong",
  "b",
  "span",
  "div",
  "p",
  "br",
  "i",
  "em",
  "small",
  "u",
];

/** Atribut yang lolos sanitasi (semua tag). `href`, `style`, `on*` dibuang. */
export const ALLOWED_ATTRS = [
  "class",
  "color",
  "to",
  "of",
  "max",
  "value",
  "shape",
  "name",
  "src",
  "field",
];

/**
 * Placeholder: `:field`, `:rel.sub.field`, `:name{:alias}`, plus formatter
 * opsional `|date` yang menempel tanpa spasi. Sama dengan regex
 * `templateLink` existing + akhiran formatter.
 */
export const PLACEHOLDER_RE = /:((\w[\w]+\{:[\w.]+\})|(\w[\w.]+))(\|\w+)?/g;

/** Formatter yang dikenal; selain ini nilai ditampilkan mentah. */
export const FORMATTERS = [
  "date",
  "datetime",
  "relative",
  "number",
  "currency",
  "percent",
  "trans",
];

const VOID_TAGS = new Set(["br"]);

/** Tag non-void yang self-closing-nya harus dinormalkan (parser HTML mengabaikan `/>`). */
const SELF_CLOSING_TAGS = [...SEMANTIC_TAGS, ...BASIC_TAGS].filter(
  (tag) => !VOID_TAGS.has(tag),
);

const SELF_CLOSING_RE = new RegExp(
  `<(${SELF_CLOSING_TAGS.join("|")})(?=[\\s/>])((?:"[^"]*"|'[^']*'|[^>"'])*?)\\s*/>`,
  "gi",
);

const TITLE_RE = /<title\b[^>]*>[\s\S]*?<\/title\s*>/gi;

/**
 * Normalisasi `<x a="1"/>` menjadi `<x a="1"></x>` untuk tag non-void.
 * Idempoten.
 * @param {string} html
 * @returns {string}
 */
export function normalizeSelfClosing(html) {
  return String(html ?? "").replace(SELF_CLOSING_RE, "<$1$2></$1>");
}

/**
 * Buang tag `<title>` beserta isinya.
 * @param {string} html
 * @returns {string}
 */
export function stripTitle(html) {
  return String(html ?? "").replace(TITLE_RE, "");
}

/* ------------------------------------------------------------------ */
/* Sanitasi                                                            */
/* ------------------------------------------------------------------ */

const DANGEROUS_BLOCK_RE =
  /<(script|style|iframe|object|embed|noscript|template|svg|math|title)\b[\s\S]*?<\/\1\s*>/gi;

const FALLBACK_TAG_RE =
  /<(\/?)([a-zA-Z][\w-]*)((?:\s+[^\s"'<>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/g;

const FALLBACK_ATTR_RE =
  /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

// Karakter kontrol di awal URL sengaja dicocokkan (browser mengabaikannya, mis. "\x01javascript:").
// eslint-disable-next-line no-control-regex
const UNSAFE_URL_RE = /^[\s\u0000-\u001f]*(javascript|vbscript|data):/i;

/**
 * Escape sisa teks di luar tag pada sanitizer fallback (entity yang sudah
 * ada dibiarkan).
 * @param {string} text
 * @returns {string}
 */
function escapeStrayAngles(text) {
  return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Sanitizer allowlist tanpa DOM (browser, SSR, node). Konservatif:
 * tag di luar allowlist dibuang (isi teks dipertahankan, kecuali blok
 * berbahaya seperti `<script>`), atribut di luar allowlist dan skema
 * `javascript:`/`data:` dibuang, `<` liar di-escape.
 * @param {string} html
 * @param {{ keepTitle?: boolean }} [options]
 * @returns {string}
 */
export function sanitizeWithoutDom(html, { keepTitle = false } = {}) {
  const allowedTags = new Set([...SEMANTIC_TAGS, ...BASIC_TAGS]);
  if (keepTitle) {
    allowedTags.add("title");
  }

  const source = String(html ?? "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(DANGEROUS_BLOCK_RE, (match, name) =>
      keepTitle && name.toLowerCase() === "title" ? match : "",
    );

  let result = "";
  let lastIndex = 0;
  FALLBACK_TAG_RE.lastIndex = 0;
  let match;
  while ((match = FALLBACK_TAG_RE.exec(source)) !== null) {
    result += escapeStrayAngles(source.slice(lastIndex, match.index));
    lastIndex = match.index + match[0].length;

    const [, closing, rawName, rawAttrs] = match;
    const name = rawName.toLowerCase();
    if (!allowedTags.has(name)) {
      continue;
    }
    if (closing) {
      result += VOID_TAGS.has(name) ? "" : `</${name}>`;
      continue;
    }

    let attrs = "";
    let attrMatch;
    FALLBACK_ATTR_RE.lastIndex = 0;
    while ((attrMatch = FALLBACK_ATTR_RE.exec(rawAttrs ?? "")) !== null) {
      const attrName = attrMatch[1].toLowerCase();
      if (!ALLOWED_ATTRS.includes(attrName)) {
        continue;
      }
      const attrValue = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? "";
      if (UNSAFE_URL_RE.test(attrValue)) {
        continue;
      }
      attrs += ` ${attrName}="${attrValue
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}"`;
    }
    result += `<${name}${attrs}>`;
  }
  result += escapeStrayAngles(source.slice(lastIndex));

  return result;
}

const SANITIZE_CACHE_LIMIT = 1000;
const sanitizeCache = new Map();
const prepareCache = new Map();

/**
 * Sanitasi template dengan allowlist tanpa DOM (browser dan SSR memakai jalur
 * yang sama). Hasil di-memo per string. Allowlist ditegakkan lagi saat
 * traversal html-react-parser di SemanticTemplate.
 * @param {string} html
 * @param {{ keepTitle?: boolean }} [options] `keepTitle`: pertahankan `<title>` (context "selected")
 * @returns {string}
 */
export function sanitizeTemplate(html, { keepTitle = false } = {}) {
  const input = String(html ?? "");
  const key = `${keepTitle ? 1 : 0}|${input}`;
  const cached = sanitizeCache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const output = sanitizeWithoutDom(input, { keepTitle });

  if (sanitizeCache.size >= SANITIZE_CACHE_LIMIT) {
    sanitizeCache.clear();
  }
  sanitizeCache.set(key, output);

  return output;
}

/**
 * Siapkan template untuk di-parse: ternary (data hanya untuk kondisi), buang
 * `<title>` (kecuali context "selected"), normalisasi self-closing, sanitasi.
 * Placeholder TIDAK diisi di sini.
 * @param {string|null|undefined} template
 * @param {object} row baris data (dipakai hanya untuk kondisi ternary)
 * @param {{ context?: "cell"|"option"|"chip"|"mobile"|"selected" }} [options]
 * @returns {string}
 */
export function prepareTemplate(template, row, { context = "cell" } = {}) {
  if (!template) {
    return "";
  }
  const source = String(template);
  // Ternary selalu mengandung "?"; tanpa itu hasil tidak bergantung pada
  // baris, jadi di-memo per (context, template) -- 1.000 sel template yang
  // sama tidak mengulang regex/sanitasi per baris.
  const cacheable = !source.includes("?");
  const key = `${context}|${source}`;
  if (cacheable) {
    const cached = prepareCache.get(key);
    if (cached !== undefined) {
      return cached;
    }
  }

  const keepTitle = context === "selected";
  let html = cacheable ? source : resolveTernaryTokens(source, row);
  if (!keepTitle) {
    html = stripTitle(html);
  }
  html = normalizeSelfClosing(html);
  const output = sanitizeTemplate(html, { keepTitle });

  if (cacheable) {
    if (prepareCache.size >= SANITIZE_CACHE_LIMIT) {
      prepareCache.clear();
    }
    prepareCache.set(key, output);
  }

  return output;
}

/* ------------------------------------------------------------------ */
/* Formatter                                                           */
/* ------------------------------------------------------------------ */

/**
 * @typedef {object} TemplateContext
 * @property {(key: string) => string} [t] fungsi terjemahan (laravel-react-i18n)
 * @property {string} [lang] locale aktif ("id" | "en")
 * @property {{ default_number_format?: string }} [preferences] preferensi user
 * @property {object} [column] kolom pemilik template (valueTrans, numberFormat, ...)
 * @property {object} [row] baris data (sumber currency)
 * @property {Date} [now] acuan waktu untuk `|relative` (default: sekarang)
 */

/**
 * Parse nilai tanggal; `null` bila tidak valid.
 * @param {unknown} value
 * @returns {TZDate|null}
 */
function parseDate(value) {
  const date = new TZDate(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Format nilai untuk ditampilkan. Nilai kosong -> "". Formatter tak dikenal
 * atau nilai tak valid -> nilai mentah sebagai string.
 * @param {unknown} value
 * @param {string|null|undefined} formatter salah satu `FORMATTERS`
 * @param {TemplateContext} [ctx]
 * @returns {string}
 */
export function formatValue(value, formatter, ctx = {}) {
  if (value == null || value === "") {
    return "";
  }
  const raw = String(value);
  if (!formatter || !FORMATTERS.includes(formatter)) {
    return raw;
  }

  const { t, lang, preferences, column, row } = ctx;
  const numberOptions = {
    numberFormat: column?.numberFormat ?? preferences?.default_number_format,
    decimalScale: column?.decimalScale,
    groupSeparator: column?.groupSeparator,
    decimalSeparator: column?.decimalSeparator,
  };

  switch (formatter) {
    case "date":
    case "datetime": {
      const date = parseDate(value);
      if (!date) {
        return raw;
      }

      return format(date, formatter === "date" ? "PPP" : "PPPpp", {
        locale: getLocaleDate(lang),
      });
    }
    case "relative": {
      const date = parseDate(value);
      if (!date) {
        return raw;
      }

      return formatDistance(date, ctx.now ?? new Date(), {
        addSuffix: true,
        locale: getLocaleDate(lang),
      });
    }
    case "number": {
      const formatted = formatNumber(value, numberOptions);

      return formatted === "" ? raw : formatted;
    }
    case "currency": {
      // Presedensi sama dengan Cell: column.currencyCode -> row.currency.
      const source = column?.currencyCode ?? row?.currency ?? null;
      const symbol = typeof source === "object" ? source?.symbol : null;
      const formatted = formatNumber(value, {
        ...numberOptions,
        prefix: symbol ? `${symbol} ` : "",
      });

      return formatted === "" ? raw : formatted;
    }
    case "percent": {
      const formatted = formatNumber(value, { ...numberOptions, suffix: "%" });

      return formatted === "" ? raw : formatted;
    }
    case "trans": {
      if (!column?.valueTrans || typeof t !== "function") {
        return raw;
      }

      return t(`${column.valueTrans}.${raw}`);
    }
    default:
      return raw;
  }
}

/* ------------------------------------------------------------------ */
/* Placeholder                                                         */
/* ------------------------------------------------------------------ */

const ALIAS_RE = /^\w[\w]+\{:([\w.]+)\}$/;

/**
 * Ubah nilai data (apa pun) menjadi teks polos. Objek relasi memakai teks
 * terlihat `templateLink`-nya, atau string/number pertama; array digabung ", ".
 * @param {unknown} value
 * @returns {string}
 */
function toPlainText(value) {
  if (value == null) {
    return "";
  }
  if (Array.isArray(value)) {
    return value
      .map(toPlainText)
      .filter((text) => text !== "")
      .join(", ");
  }
  if (typeof value === "object") {
    if (typeof value.templateLink === "string") {
      return templateToText(value.templateLink, value);
    }
    const first = Object.values(value).find(
      (v) => typeof v === "string" || typeof v === "number",
    );

    return first == null ? "" : String(first);
  }

  return String(value);
}

/**
 * Isi placeholder dalam satu lintasan (nilai yang berisi `:field` tidak
 * diekspansi ulang). Nilai null/undefined -> "". Hasilnya string polos: HTML
 * escaping dilakukan React saat dirender.
 * @param {string|null|undefined} text
 * @param {object} row
 * @param {object} [column] kolom (untuk `|trans`, `|number`, ...)
 * @param {TemplateContext} [ctx]
 * @returns {string}
 */
export function fillPlaceholders(text, row, column, ctx = {}) {
  if (!text) {
    return "";
  }
  const formatCtx = { ...ctx, column, row };

  return String(text).replace(
    PLACEHOLDER_RE,
    (_match, token, _alias, _path, formatter) => {
      const aliasMatch = ALIAS_RE.exec(token);
      let path = aliasMatch ? aliasMatch[1] : token;
      // Titik di akhir kalimat ("...:name.") bukan bagian path.
      const trailingDots = /\.+$/.exec(path)?.[0] ?? "";
      path = path.slice(0, path.length - trailingDots.length);

      const value = getValueObject(row, path);
      const isScalar = value == null || typeof value !== "object";
      const text = isScalar
        ? formatValue(value, formatter?.slice(1), formatCtx)
        : toPlainText(value);

      return text + trailingDots;
    },
  );
}

/**
 * Isi placeholder pada nilai atribut tag (mis. `value=":per_billed"`).
 * @param {Record<string, string>} attribs
 * @param {object} row
 * @param {object} [column]
 * @param {TemplateContext} [ctx]
 * @returns {Record<string, string>}
 */
export function fillAttrs(attribs, row, column, ctx = {}) {
  return Object.fromEntries(
    Object.entries(attribs ?? {}).map(([name, value]) => [
      name,
      fillPlaceholders(value, row, column, ctx),
    ]),
  );
}

const TAG_STRIP_RE = /<\/?[a-zA-Z][\w-]*(?:"[^"]*"|'[^']*'|[^'">])*>/g;

const TEXT_ENTITIES = [
  ["&nbsp;", " "],
  ["&lt;", "<"],
  ["&gt;", ">"],
  ["&quot;", '"'],
  ["&#39;", "'"],
  ["&amp;", "&"], // terakhir agar "&amp;lt;" tidak ter-decode dua kali
];

/**
 * Teks yang terlihat dari sebuah template: ternary diselesaikan, `<title>`
 * dibuang, tag dibuang (batas tag menjadi spasi), placeholder diisi dengan
 * nilai baris. Dipakai pencocokan pencarian LinkModel (bukan string HTML).
 * @param {string|null|undefined} template
 * @param {object} row
 * @param {object} [column]
 * @param {TemplateContext} [ctx]
 * @returns {string}
 */
export function templateToText(template, row, column, ctx = {}) {
  if (!template) {
    return "";
  }
  const withoutTags = stripTitle(resolveTernaryTokens(String(template), row))
    .replace(TAG_STRIP_RE, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const decoded = TEXT_ENTITIES.reduce(
    (text, [entity, char]) => text.split(entity).join(char),
    withoutTags,
  );

  return fillPlaceholders(decoded, row, column, ctx)
    .replace(/\s+/g, " ")
    .trim();
}
