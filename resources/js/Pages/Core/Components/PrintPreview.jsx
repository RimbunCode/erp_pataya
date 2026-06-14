import React, { forwardRef, useEffect, useMemo } from "react";

import Handlebars from "handlebars";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { formatValue } from "@/Components/CurrencyInput";
import { getLocaleDate, getSafePrintFontFamily } from "@/lib/utils";
import { initHandlebar } from "@/lib/initHandlebar";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

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
          newData[key] = formatValue({
            value: value.toString(),
            intlConfig: {
              locale: opts.lang,
              currency:
                col.type == "number"
                  ? undefined
                  : col.currencyCode || opts.defaultCurrencyCode,
            },
            decimalScale: col.decimalScale ?? 0,
          });
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
      absoluteNumber: template?.show_absolute_values ?? false,
    });
  }, [_doc, template, t, default_currency_id]);
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
