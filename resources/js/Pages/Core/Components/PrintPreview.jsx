import React, { forwardRef, useEffect, useMemo, useState } from "react";

import Handlebars from "handlebars";
import { getCurrencyConfig } from "@/Components/NumberInput/getCurrencyConfig";
import { initHandlebar } from "@/lib/initHandlebar";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";
import {
  buildPrintLayoutCss,
  collectCurrencyCodes,
  formatData,
  PRINT_TEMPLATE_SCOPES,
  scopeTemplateCss,
  scopeTemplateHtml,
} from "./printTemplateRender";

export default forwardRef(function PrintPreview({ template }, ref) {
  const {
    doc: _doc,
    columns,
    docInfo: _docInfo,
    preferences,
    document,
    approvalSignature,
    creatorSignature,
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
    const codes = new Set(collectCurrencyCodes(columns, _doc));
    if (default_currency_id) codes.add(default_currency_id.toUpperCase());
    if (codes.size === 0) {
      setCurrencySymbols({});
      return;
    }
    Promise.all(
      [...codes].map((code) =>
        getCurrencyConfig(code, default_currency_id)
          .then((cfg) => [code.toUpperCase(), cfg?.symbol ?? null])
          .catch(() => [code.toUpperCase(), null]),
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
  }, [columns, _doc, default_currency_id]);

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
        scopeTemplateCss(
          letterHeadTemplate.css,
          PRINT_TEMPLATE_SCOPES.letterHead,
        ) +
        ".resize-divider{display:none !important;}.gjs-cell{display: table-cell !important;}";
      html = Handlebars.compile(
        scopeTemplateHtml(
          letterHeadTemplate.html,
          PRINT_TEMPLATE_SCOPES.letterHead,
        ),
      )({
        lang: template.default_language ?? "en",
        modelDoc: template.model,
        columns,
        company: preferences,
        docInfo,
      });
    }

    css +=
      scopeTemplateCss(template.css, PRINT_TEMPLATE_SCOPES.template) +
      ".resize-divider{display:none !important;}";
    html += Handlebars.compile(
      scopeTemplateHtml(template.html, PRINT_TEMPLATE_SCOPES.template),
    )({
      lang: template.default_language ?? "en",
      modelDoc: template.model,
      columns,
      company: preferences,
      docInfo,
      document,
      doc,
      // Diresolusi server (berkas TTD tidak publik); dibaca helper
      // `approvalSignature` lewat `data.root`.
      approvalSignature,
      creatorSignature,
    });
    return {
      html,
      css,
    };
  }, [
    doc,
    template,
    t,
    columns,
    preferences,
    docInfo,
    document,
    approvalSignature,
    creatorSignature,
  ]);

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
    style.innerHTML = css + buildPrintLayoutCss(template);
    const unitCode = template.unit ?? "cm";
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
