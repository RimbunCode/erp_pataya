import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

import { formatNumber } from "@/Components/NumberInput/formatNumber";
import { getLocaleDate, getSafePrintFontFamily } from "@/lib/utils";

export const PRINT_TEMPLATE_SCOPES = {
  letterHead: ".pt-scope--letterhead",
  template: ".pt-scope--template",
};

export const PRINT_WRAPPER_OVERRIDES = `
.gjs-static-html-wrapper {
  border: none !important;
  border-radius: 0 !important;
  padding: 0 !important;
}
.gjs-static-html-wrapper::before {
  content: none !important;
  display: none !important;
}
`;

function separatorsForLocale(lang) {
  return typeof lang === "string" && lang.toLowerCase().startsWith("id")
    ? { groupSeparator: ".", decimalSeparator: "," }
    : { groupSeparator: ",", decimalSeparator: "." };
}

function replaceBodySelector(selector, scope) {
  let result = "";
  let quote = "";
  let bracketDepth = 0;

  for (let index = 0; index < selector.length; index += 1) {
    const char = selector[index];
    if (selector.slice(index, index + 2) === "/*") {
      const end = selector.indexOf("*/", index + 2);
      if (end === -1) return result + selector.slice(index);
      result += selector.slice(index, end + 2);
      index = end + 1;
      continue;
    }
    if (quote) {
      result += char;
      if (char === "\\") {
        result += selector[index + 1] ?? "";
        index += 1;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      result += char;
      continue;
    }
    if (char === "[") bracketDepth += 1;
    if (char === "]") bracketDepth -= 1;

    if (
      bracketDepth === 0 &&
      selector.slice(index, index + 4).toLowerCase() === "body" &&
      !/[\w-]/.test(selector[index - 1] ?? "") &&
      !/[\w-]/.test(selector[index + 4] ?? "") &&
      !/[.#]/.test(selector[index - 1] ?? "")
    ) {
      result += scope;
      index += 3;
      continue;
    }
    result += char;
  }

  return result;
}

function scopeSelectorList(selectorList, scope) {
  return selectorList
    .split(",")
    .map((selector) => {
      const trimmed = selector.trim();
      if (!trimmed) return selector;
      const scoped = replaceBodySelector(trimmed, scope);
      return scoped.includes(scope) ? scoped : `${scope} ${scoped}`;
    })
    .join(",");
}

function findMatchingBrace(source, openIndex) {
  let depth = 1;
  let quote = "";
  for (let index = openIndex + 1; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}" && --depth === 0) {
      return index;
    }
  }
  return -1;
}

function scopeCssBlock(source, scope) {
  let output = "";
  let offset = 0;
  while (offset < source.length) {
    const openIndex = source.indexOf("{", offset);
    if (openIndex === -1) return output + source.slice(offset);
    const closeIndex = findMatchingBrace(source, openIndex);
    if (closeIndex === -1) return output + source.slice(offset);

    const prelude = source.slice(offset, openIndex);
    const content = source.slice(openIndex + 1, closeIndex);
    const atRule = prelude.trim().startsWith("@");
    const nestedAtRule =
      /^\s*@(media|supports|layer|container|document)\b/i.test(prelude);
    output += `${atRule ? prelude : scopeSelectorList(prelude, scope)}{${
      nestedAtRule ? scopeCssBlock(content, scope) : content
    }}`;
    offset = closeIndex + 1;
  }
  return output;
}

/**
 * Mengganti hanya root body. tbody dan teks konten tidak disentuh.
 * @param {string} source
 * @param {string} scope
 * @returns {string}
 */
export function scopeTemplateHtml(source, scope) {
  const html = source ?? "";
  const opening = /<body\b[^>]*>/i;
  const closing = /<\/body\s*>(?![\s\S]*<\/body\s*>)/i;
  if (!opening.test(html) || !closing.test(html)) return html;
  const bodyTag = html.match(opening)?.[0] ?? "";
  const attributes = bodyTag.replace(/^<body\b|>$/gi, "");
  const scopeClasses = `pt-scope ${scope.slice(1)}`;
  const sectionAttributes = /\sclass\s*=\s*(["'])(.*?)\1/i.test(attributes)
    ? attributes.replace(
        /\sclass\s*=\s*(["'])(.*?)\1/i,
        (_, quote, classes) =>
          ` class=${quote}${classes} ${scopeClasses}${quote}`,
      )
    : `${attributes} class="${scopeClasses}"`;

  return html
    .replace(opening, `<section${sectionAttributes}>`)
    .replace(closing, "</section>");
}

/**
 * Scope semua selector normal. Token body diganti hanya saat menjadi selector.
 * @param {string} source
 * @param {string} scope
 * @returns {string}
 */
export function scopeTemplateCss(source, scope) {
  return scopeCssBlock(source ?? "", scope);
}

/**
 * CSS layout halaman. Aturan `.pt-scope` (font) harus dipasang SETELAH CSS
 * template ter-scope (spesifisitas sama, urutan menentukan). Margin tetap di
 * `body`. Kembaran JS dari `PrintTemplateSourceScoper::layoutCss`.
 * @param {object} template
 * @returns {string}
 */
export function buildPrintLayoutCss(template) {
  const unit = template?.unit ?? "cm";
  const fontFamily = getSafePrintFontFamily(template?.font_family);
  const margins = `${template?.margin_top ?? 0}${unit} ${template?.margin_right ?? 0}${unit} ${template?.margin_bottom ?? 0}${unit} ${template?.margin_left ?? 0}${unit}`;
  const pageNumber =
    !template?.page_number || template.page_number === "hide"
      ? ""
      : `@${template.page_number.replace("_", "-")} { content: '${(template.page_number_format ?? ":page / :total").replace(":page", "'counter(page)'").replace(":total", "'counter(pages)'")}'; font-size: 10pt; }`;

  return `${PRINT_WRAPPER_OVERRIDES}
body { font-family: ${fontFamily}; margin: ${margins}; }
.pt-scope { font-family: ${fontFamily}; }
@media print {
  @page { size: ${template?.width}${unit} ${template?.height}${unit}; margin: ${margins}; ${pageNumber} }
  body { margin: 0; }
}`;
}

export function resolveCurrencySymbol(col, data, opts) {
  const symbols = opts.currencySymbols ?? {};
  const fromCode = (code) =>
    typeof code === "string" ? (symbols[code.toUpperCase()] ?? "") : "";
  const currency = col?.currencyCode ?? data?.currency;
  if (currency) {
    return typeof currency === "object"
      ? (currency.symbol ?? fromCode(currency.code))
      : fromCode(currency);
  }
  return fromCode(data?.currency_code) || fromCode(opts.defaultCurrencyCode);
}

export function collectCurrencyCodes(columns, data) {
  const codes = new Set();
  const add = (code) => {
    if (typeof code === "string" && code) codes.add(code.toUpperCase());
  };
  const collect = (value) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) return value.forEach(collect);
    add(value.currency_code);
    Object.values(value).forEach(collect);
  };

  Object.values(columns ?? {}).forEach((modelColumns) => {
    Object.values(modelColumns ?? {}).forEach((column) => {
      if (column?.type !== "currency") return;
      const currency = column.currencyCode;
      add(typeof currency === "object" ? currency.code : currency);
    });
  });
  collect(data);
  return [...codes];
}

export function formatData(data, columns, opts = {}) {
  if (!data || typeof data !== "object") return data;
  const modelColumns = columns?.[opts.model];
  if (!modelColumns) return data;

  return Object.fromEntries(
    Object.entries(data).map(([key, rawValue]) => {
      const column = modelColumns[key];
      if (!column || key === "templateLink") return [key, rawValue];
      if (column.type === "relation") {
        return [
          key,
          formatData(rawValue, columns, { ...opts, model: column.related }),
        ];
      }
      if (column.type === "relations") {
        return [
          key,
          (rawValue ?? []).map((item) =>
            formatData(item, columns, { ...opts, model: column.related }),
          ),
        ];
      }
      if (["date", "time", "datetime"].includes(column.type)) {
        if (rawValue == null || rawValue === "") return [key, rawValue];
        const date = new TZDate(rawValue, "UTC");
        return [
          key,
          Number.isNaN(date.getTime())
            ? rawValue
            : format(
                date,
                column.type === "date"
                  ? "PPP"
                  : column.type === "time"
                    ? "pp"
                    : "PPPpp",
                { locale: getLocaleDate(opts.lang) },
              ),
        ];
      }
      if (column.type === "boolean") {
        return [key, `<input type='checkbox' ${rawValue ? "checked" : ""}>`];
      }
      if (column.type === "formStatus")
        return [key, opts.t(`status.${rawValue}`)];
      if (column.type === "string") {
        return [
          key,
          column.valueTrans
            ? opts.t(`${column.valueTrans}.${rawValue?.toString()}`)
            : column.parse
              ? (column.parse[rawValue?.toString()] ?? "")
              : rawValue,
        ];
      }
      if (["currency", "number"].includes(column.type)) {
        const value = opts.absoluteNumber ? Math.abs(rawValue) : rawValue;
        try {
          const { groupSeparator, decimalSeparator } = separatorsForLocale(
            opts.lang,
          );
          const symbol =
            column.type === "currency"
              ? resolveCurrencySymbol(column, data, opts)
              : "";
          const formatted = formatNumber(value, {
            groupSeparator,
            decimalSeparator,
            decimalScale: column.decimalScale ?? 0,
            prefix: symbol ? `${symbol} ` : "",
          });
          return [key, formatted === "" ? rawValue : formatted];
        } catch {
          return [key, rawValue];
        }
      }
      return [key, rawValue];
    }),
  );
}
