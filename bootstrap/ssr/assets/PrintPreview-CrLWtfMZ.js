import { jsx } from "react/jsx-runtime";
import { forwardRef, useEffect, useMemo } from "react";
import Handlebars from "handlebars";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { f as formatValue } from "./CurrencyInput-DtXsGVaN.js";
import { a as getLocaleDate } from "./utils-ClCZGsDL.js";
import { i as initHandlebar } from "./initHandlebar-DkcLBbFK.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";
import "./Link-p0Z4AKax.js";
import "@inertiajs/core";
import "zustand";
import "date-fns/locale";
import "lodash";
import "buffer";
import "clsx";
import "tailwind-merge";
import "./checkbox-C_BEU5E4.js";
import "@radix-ui/react-checkbox";
import "lucide-react";
import "class-variance-authority";
import "./MasterLayout-CRsmljQs.js";
import "@radix-ui/react-alert-dialog";
import "./button-Us2TB7GG.js";
import "radix-ui";
import "./use-mobile-BsFue-bT.js";
import "sonner";
import "./tooltip-Df8khweJ.js";
import "@radix-ui/react-tooltip";
import "./avatar-_KK8H2Pc.js";
import "@radix-ui/react-avatar";
import "./AppLayout-Drqdr6Z-.js";
import "./command-BSnyCa9u.js";
import "@radix-ui/react-dialog";
import "cmdk";
import "./input-wk3Ou7wI.js";
import "@radix-ui/react-separator";
import "./skeleton-IN0PLOYc.js";
import "@radix-ui/react-slot";
import "./ToggleTheme-BSs-sHS2.js";
import "@radix-ui/react-dropdown-menu";
import "./popover-CziqY8mR.js";
import "@radix-ui/react-popover";
import "./LoadingIcon-CRleOEtX.js";
import "axios";
import "pluralize";
import "react-detect-click-outside";
import "./tabs-DhZjhdeH.js";
import "@radix-ui/react-tabs";
import "./InputError-2JjWc6nJ.js";
import "./label-DiFvdPYz.js";
import "@radix-ui/react-label";
import "./Select-DB9toH_t.js";
import "@radix-ui/react-accordion";
import "qs";
import "@radix-ui/react-progress";
import "@headlessui/react";
import "./Comments-Bvo3255G.js";
import "quill-mention/autoregister";
import "quill";
import "@remixicon/react";
import "./Tags-D6pM3ZUY.js";
import "@marcbachmann/cel-js";
function formatData(data, columns, opts = {}) {
  const cols = columns.reduce((a, b) => ({ ...a, [b.name]: b }), {});
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
        newData[key] = formatData(value, col.columns, opts);
        break;
      }
      case "relations": {
        newData[key] = value.map((item) => formatData(item, col.columns, opts));
        break;
      }
      case "date":
      case "time":
      case "datetime": {
        newData[key] = format(
          new TZDate(value, "UTC"),
          col.type == "date" ? "PPP" : col.type == "time" ? "pp" : "PPPpp",
          {
            locale: getLocaleDate(opts.lang)
          }
        );
        break;
      }
      case "boolean": {
        newData[key] = "<input type='checkbox' " + (value ? "checked" : "") + ">";
        break;
      }
      case "formStatus": {
        newData[key] = opts.t(`status.${value}`);
        break;
      }
      case "string": {
        newData[key] = col.valueTrans ? opts.t(`${col.valueTrans}.${value == null ? void 0 : value.toString()}`) : col.parse ? col.parse[value == null ? void 0 : value.toString()] ?? "" : value;
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
              currency: col.type == "number" ? void 0 : col.currencyCode || opts.defaultCurrencyCode,
              decimalScale: col.decimalScale
            }
          });
        } catch (e) {
          newData[key] = value;
          console.log(e);
        }
        break;
      }
      default:
        newData[key] = value;
    }
  }
  return newData;
}
const PrintPreview = forwardRef(function PrintPreview2({ template }, ref) {
  const {
    data: _data,
    dataTableColumns,
    preferences,
    document
  } = usePage().props;
  const { t, setLocale } = useLaravelReactI18n();
  const { default_currency_id } = usePage().props.preferences;
  useEffect(() => {
    setLocale(template.default_languange ?? "en");
  }, [template.default_languange]);
  const data = useMemo(() => {
    var _a, _b;
    return formatData(
      _data,
      ((_b = (_a = template == null ? void 0 : template.columns) == null ? void 0 : _a.find((x) => x.type == "data")) == null ? void 0 : _b.columns) ?? [],
      {
        t,
        lang: template.default_languange ?? "en",
        defaultCurrencyCode: default_currency_id,
        absoluteNumber: (template == null ? void 0 : template.show_absolute_values) ?? false
      }
    );
  }, [_data, template, t, default_currency_id]);
  const { html, css } = useMemo(() => {
    var _a, _b, _c, _d;
    initHandlebar(t);
    let css2 = "";
    let html2 = "";
    if (!template.is_letter_head && template.letter_head) {
      const letterHeadTemplate = template.letter_head;
      css2 = (((_a = letterHeadTemplate.css) == null ? void 0 : _a.replace("body", "div")) ?? "") + ".resize-divider{display:none !important;}.gjs-cell{display: table-cell !important;}";
      html2 = Handlebars.compile(
        "{{#with preferences}}" + (((_b = letterHeadTemplate == null ? void 0 : letterHeadTemplate.html) == null ? void 0 : _b.replace("body", "div")) ?? "") + "{{/with}}"
      )({
        dataTableColumns,
        preferences
      });
    }
    css2 += (((_c = template.css) == null ? void 0 : _c.replace("body", "main")) ?? "") + ".resize-divider{display:none !important;}";
    html2 += Handlebars.compile(
      "{{#with data}}" + (((_d = template == null ? void 0 : template.html) == null ? void 0 : _d.replace("body", "main")) ?? "") + "{{/with}}"
    )({
      dataTableColumns: (template == null ? void 0 : template.columns) ?? [],
      preferences,
      document,
      data
    });
    return {
      html: html2,
      css: css2
    };
  }, [data, template, t]);
  useEffect(() => {
    var _a, _b, _c;
    if (!(ref == null ? void 0 : ref.current)) return;
    ref.current.contentDocument.body.innerHTML = html;
    const style = ref.current.contentDocument.head.getElementsByTagName("style")[0] ?? ref.current.contentDocument.createElement("style");
    const unitCode = template.unit;
    style.innerHTML = css + `
      body{
        font-family: ${template.font_family};
        margin: ${template.margin_top ?? 0}${unitCode} ${template.margin_right ?? 0}${unitCode} ${template.margin_bottom ?? 0}${unitCode} ${template.margin_left ?? 0}${unitCode};
      }
      @media print {
        @page{
          size: ${template.width}${unitCode} ${template.height}${unitCode};
          margin: ${template.margin_top ?? 0}${unitCode} ${template.margin_right ?? 0}${unitCode} ${template.margin_bottom ?? 0}${unitCode} ${template.margin_left ?? 0}${unitCode};
          ${!(template == null ? void 0 : template.page_number) || (template == null ? void 0 : template.page_number) == "hide" ? "" : `
            @${(_a = template == null ? void 0 : template.page_number) == null ? void 0 : _a.replace("_", "-")} {
              content: '${(_c = (_b = (template == null ? void 0 : template.page_number_format) ?? ":page / :total") == null ? void 0 : _b.replace(":page", "'counter(page)'")) == null ? void 0 : _c.replace(":total", "'counter(pages)'")}';
              font-size: 10pt;
            }
          `}
        }
        body{
          margin: 0px;
        }
      }
    `;
    if (!ref.current.contentDocument.head.getElementsByTagName("style")[0])
      ref.current.contentDocument.head.appendChild(style);
    ref.current.style.width = `${template.width}${unitCode}`;
    ref.current.style.minHeight = `${template.height}${unitCode}`;
    return () => {
      if (!(ref == null ? void 0 : ref.current)) return;
      ref.current.contentDocument.body.innerHTML = "";
      ref.current.contentDocument.head.innerHTML = "";
    };
  }, [html, css, ref, template]);
  return /* @__PURE__ */ jsx("iframe", { ref, "data-role": "print-preview" });
});
export {
  PrintPreview as default
};
