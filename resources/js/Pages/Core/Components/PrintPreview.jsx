import React, { forwardRef, useEffect, useMemo, useState } from "react";

import Handlebars from "handlebars";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { formatNumber } from "@/Components/NumberInput/formatNumber";
import { getCurrencyConfig } from "@/Components/NumberInput/getCurrencyConfig";
import { getLocaleDate, getSafePrintFontFamily } from "@/lib/utils";
import { initHandlebar } from "@/lib/initHandlebar";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

/**
 * Pemisah angka berdasarkan locale: "id" memakai ribuan "." & desimal ",",
 * selain itu memakai gaya "en" (ribuan "," & desimal ".").
 * @param {string} [lang]
 * @returns {{ groupSeparator: string, decimalSeparator: string }}
 */
function separatorsForLocale(lang) {
  if (typeof lang === "string" && lang.toLowerCase().startsWith("id")) {
    return { groupSeparator: ".", decimalSeparator: "," };
  }
  return { groupSeparator: ",", decimalSeparator: "." };
}

/**
 * Resolusi currency untuk satu nilai dengan precedence (sama seperti Table2 Cell):
 * `col.currencyCode` → `data.currency` → default. Mengembalikan symbol string
 * (lewat map `currencySymbols` yang sudah di-pre-resolve di komponen) atau "".
 * @param {object} col definisi kolom
 * @param {object} data row data yang sedang diformat
 * @param {object} opts berisi `currencySymbols` (map code→symbol) & `defaultCurrencyCode`
 * @returns {string} symbol currency atau ""
 */
function resolveCurrencySymbol(col, data, opts) {
  const symbols = opts.currencySymbols ?? {};

  // 1) col.currencyCode (string code, atau object {code,symbol}).
  const colCurrency = col?.currencyCode;
  if (colCurrency) {
    if (typeof colCurrency === "object") {
      return colCurrency.symbol ?? symbols[colCurrency.code] ?? "";
    }
    return symbols[colCurrency] ?? "";
  }

  // 2) data.currency (object dari backend, symbol dijamin tersedia).
  const rowCurrency = data?.currency;
  if (rowCurrency) {
    if (typeof rowCurrency === "object") {
      return rowCurrency.symbol ?? symbols[rowCurrency.code] ?? "";
    }
    return symbols[rowCurrency] ?? "";
  }

  // 3) default.
  return symbols[opts.defaultCurrencyCode] ?? "";
}

/**
 * Mengumpulkan semua currency code unik (string) yang dipakai kolom bertipe
 * "currency" di seluruh model pada konfigurasi columns. Dipakai untuk
 * pre-resolve symbol sekali sebelum render (formatData bersifat sinkron).
 * @param {object} columns map model→(map field→col)
 * @returns {string[]} daftar code unik
 */
function collectCurrencyCodes(columns) {
  const codes = new Set();
  if (!columns || typeof columns !== "object") return [];
  for (const model in columns) {
    const cols = columns[model];
    if (!cols || typeof cols !== "object") continue;
    for (const field in cols) {
      const col = cols[field];
      if (col?.type !== "currency") continue;
      const cc = col.currencyCode;
      if (typeof cc === "string" && cc) {
        codes.add(cc);
      } else if (cc && typeof cc === "object" && cc.code && !cc.symbol) {
        codes.add(cc.code);
      }
    }
  }
  return [...codes];
}

function formatData(data, columns, opts = {}) {
  const cols = columns[opts.model];
  if (!cols) return data;
  const newData = {};
  for (let key in data) {
    const col = cols[key];
    let value = data[key];
    if (key == "templateLink") {
      newData[key] = value;
      continue;
    }
    if (col == null) continue;
    switch (col.type) {
      case "relation": {
        newData[key] = formatData(value, columns, {
          ...opts,
          model: col.related,
        });
        break;
      }
      case "relations": {
        newData[key] = value.map((item) =>
          formatData(item, columns, { ...opts, model: col.related }),
        );
        break;
      }
      case "date":
      case "time":
      case "datetime": {
        newData[key] = format(
          new TZDate(value, "UTC"),
          col.type == "date" ? "PPP" : col.type == "time" ? "pp" : "PPPpp",
          {
            locale: getLocaleDate(opts.lang),
          },
        );
        break;
      }
      case "boolean": {
        newData[key] =
          "<input type='checkbox' " + (value ? "checked" : "") + ">";
        break;
      }
      case "formStatus": {
        newData[key] = opts.t(`status.${value}`);
        break;
      }

      case "string": {
        newData[key] = col.valueTrans
          ? opts.t(`${col.valueTrans}.${value?.toString()}`)
          : col.parse
            ? (col.parse[value?.toString()] ?? "")
            : value;
        break;
      }
      case "currency":
      case "number": {
        if (opts.absoluteNumber) {
          value = Math.abs(value);
        }
        try {
          const { groupSeparator, decimalSeparator } = separatorsForLocale(
            opts.lang,
          );
          // number → tanpa symbol; currency → symbol via precedence col→row→default.
          const prefix =
            col.type === "currency"
              ? (() => {
                  const symbol = resolveCurrencySymbol(col, data, opts);
                  return symbol ? `${symbol} ` : "";
                })()
              : "";
          const formatted = formatNumber(value, {
            groupSeparator,
            decimalSeparator,
            decimalScale: col.decimalScale ?? 0,
            prefix,
          });
          newData[key] = formatted === "" ? value : formatted;
        } catch {
          newData[key] = value;
        }
        break;
      }
      default:
        newData[key] = value;
    }
  }
  return newData;
}
/**
 * CSS overrides to hide editor-only styles on the static HTML wrapper
 * in print preview/export mode (Requirements: 24.1, 24.2).
 */
const PRINT_WRAPPER_OVERRIDES = `
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

export default forwardRef(function PrintPreview({ template }, ref) {
  const {
    doc: _doc,
    columns,
    docInfo: _docInfo,
    preferences,
    document,
  } = usePage().props;
  const { t, setLocale } = useLaravelReactI18n();

  const { default_currency_id } = usePage().props.preferences;

  // Pre-resolve symbol currency (map code→symbol) untuk semua code yang dipakai
  // kolom + default. formatData bersifat sinkron, jadi symbol harus siap di map
  // sebelum format dijalankan; `data.currency.symbol` dari backend tetap dipakai
  // langsung tanpa map (lihat resolveCurrencySymbol).
  const [currencySymbols, setCurrencySymbols] = useState({});
  useEffect(() => {
    let ignore = false;
    const codes = new Set(collectCurrencyCodes(columns));
    if (default_currency_id) codes.add(default_currency_id);
    if (codes.size === 0) {
      setCurrencySymbols({});
      return;
    }
    Promise.all(
      [...codes].map((code) =>
        getCurrencyConfig(code, default_currency_id)
          .then((cfg) => [code, cfg?.symbol ?? null])
          .catch(() => [code, null]),
      ),
    ).then((entries) => {
      if (ignore) return;
      const map = {};
      for (const [code, symbol] of entries) {
        if (symbol) map[code] = symbol;
      }
      setCurrencySymbols(map);
    });
    return () => {
      ignore = true;
    };
  }, [columns, default_currency_id]);

  useEffect(() => {
    setLocale(template.default_language ?? "en");
  }, [template.default_language]);

  const doc = useMemo(() => {
    // return _doc;
    return formatData(_doc, columns, {
      t,
      model: template.model,
      lang: template.default_language ?? "en",
      defaultCurrencyCode: default_currency_id,
      currencySymbols,
      absoluteNumber: template?.show_absolute_values ?? false,
    });
  }, [_doc, template, t, default_currency_id, currencySymbols]);
  const docInfo = useMemo(() => {
    const newData = {};
    for (let key in _docInfo) {
      newData[key] = t(_docInfo[key]);
    }
    return newData;
  }, [_docInfo, t]);
  const { html, css } = useMemo(() => {
    initHandlebar(t);
    let css = "";
    let html = "";
    if (!template.is_letter_head && template.letter_head) {
      const letterHeadTemplate = template.letter_head;
      css =
        (letterHeadTemplate.css?.replace("body", "div") ?? "") +
        ".resize-divider{display:none !important;}.gjs-cell{display: table-cell !important;}";
      html = Handlebars.compile(
        letterHeadTemplate?.html?.replace("body", "div") ?? "",
      )({
        lang: template.default_language ?? "en",
        modelDoc: template.model,
        columns,
        company: preferences,
        docInfo,
      });
    }

    css +=
      (template.css?.replace("body", "main") ?? "") +
      ".resize-divider{display:none !important;}";
    html += Handlebars.compile(template?.html?.replace("body", "main") ?? "")({
      lang: template.default_language ?? "en",
      modelDoc: template.model,
      columns,
      company: preferences,
      docInfo,
      document,
      doc,
    });
    return {
      html,
      css,
    };
  }, [doc, template, t]);

  useEffect(() => {
    if (!ref?.current) return;
    const doc = ref.current.contentDocument;
    doc.body.innerHTML = html;

    // Ensure Bootstrap CSS is loaded via <link> in the iframe head
    let bootstrapLink = doc.getElementById("bootstrap-css-link");
    if (!bootstrapLink) {
      bootstrapLink = doc.createElement("link");
      bootstrapLink.id = "bootstrap-css-link";
      bootstrapLink.rel = "stylesheet";
      bootstrapLink.href =
        "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css";
      doc.head.appendChild(bootstrapLink);
    }

    const style =
      doc.head.querySelector("style#print-preview-style") ??
      doc.createElement("style");
    style.id = "print-preview-style";
    const unitCode = template.unit ?? "cm";
    const fontFamily = getSafePrintFontFamily(template.font_family);
    style.innerHTML =
      PRINT_WRAPPER_OVERRIDES +
      css +
      `
      body{
        font-family: ${fontFamily};
        margin: ${template.margin_top ?? 0}${unitCode} ${template.margin_right ?? 0}${unitCode} ${template.margin_bottom ?? 0}${unitCode} ${template.margin_left ?? 0}${unitCode};
      }
      @media print {
        @page{
          size: ${template.width}${unitCode} ${template.height}${unitCode};
          margin: ${template.margin_top ?? 0}${unitCode} ${template.margin_right ?? 0}${unitCode} ${template.margin_bottom ?? 0}${unitCode} ${template.margin_left ?? 0}${unitCode};
          ${
            !template?.page_number || template?.page_number == "hide"
              ? ""
              : `
            @${template?.page_number?.replace("_", "-")} {
              content: '${(template?.page_number_format ?? ":page / :total")?.replace(":page", "'counter(page)'")?.replace(":total", "'counter(pages)'")}';
              font-size: 10pt;
            }
          `
          }
        }
        body{
          margin: 0px;
        }
      }
    `;
    if (!doc.head.querySelector("style#print-preview-style"))
      doc.head.appendChild(style);

    ref.current.style.width = `${template.width}${unitCode}`;
    ref.current.style.minHeight = `${template.height}${unitCode}`;

    return () => {
      if (!ref?.current) return;
      ref.current.contentDocument.body.innerHTML = ""; // clear doc
      ref.current.contentDocument.head.innerHTML = "";
    };
  }, [html, css, ref, template]);

  return <iframe ref={ref} data-role="print-preview" />;
});
