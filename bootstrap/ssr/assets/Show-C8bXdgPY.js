import { jsx, Fragment, jsxs } from "react/jsx-runtime";
import { M as MentionsInput, a as Mention } from "./Mention-CB0VqwkR.js";
import { u as useFormPage, g as FormPageContent, a as FormInput } from "./checkbox-C_BEU5E4.js";
import { useState, useCallback, useMemo } from "react";
import { I as Input } from "./input-wk3Ou7wI.js";
import { x as getRandomInt } from "./utils-ClCZGsDL.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";
import "react-mentions";
import "@radix-ui/react-checkbox";
import "lucide-react";
import "class-variance-authority";
import "./MasterLayout-CRsmljQs.js";
import "@radix-ui/react-alert-dialog";
import "./button-Us2TB7GG.js";
import "radix-ui";
import "./use-mobile-BsFue-bT.js";
import "sonner";
import "zustand";
import "./tooltip-Df8khweJ.js";
import "@radix-ui/react-tooltip";
import "./Link-p0Z4AKax.js";
import "@inertiajs/core";
import "./avatar-_KK8H2Pc.js";
import "@radix-ui/react-avatar";
import "./AppLayout-Drqdr6Z-.js";
import "./command-BSnyCa9u.js";
import "@radix-ui/react-dialog";
import "cmdk";
import "@radix-ui/react-separator";
import "./skeleton-IN0PLOYc.js";
import "@radix-ui/react-slot";
import "./ToggleTheme-BSs-sHS2.js";
import "@radix-ui/react-dropdown-menu";
import "./popover-CziqY8mR.js";
import "@radix-ui/react-popover";
import "./LoadingIcon-CRleOEtX.js";
import "axios";
import "lodash";
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
import "@date-fns/tz";
import "date-fns";
import "date-fns/locale";
import "buffer";
import "clsx";
import "tailwind-merge";
import "@remixicon/react";
import "./Tags-D6pM3ZUY.js";
import "@marcbachmann/cel-js";
function Show() {
  const { t } = useLaravelReactI18n();
  const codeFormats = usePage().props.codeFormats;
  const [error, setError] = useState(null);
  const { data, setData } = useFormPage();
  const checkError = useCallback(
    (format) => {
      if (!/^(?:(?=.*@\[(mm|mmm|mmmm)\])(?=.*@\[(yy|yyyy)\])|(?=.*@\[(yy|yyyy)\])|(?!.*@\[(?:mm|mmm|mmmm|yy|yyyy)\])).*$/g.test(
        format
      )) {
        return t("core.formatingSeries.errors.month_invalid");
      }
      if (!/@\[[i]+\]/.test(format)) {
        return t("core.formatingSeries.errors.increment_notfound");
      }
    },
    [t]
  );
  const getData = useCallback(
    (search) => {
      const contains = /@\[[i]+\]/.test(data.format);
      let list = [];
      if (!contains) {
        const fixedLengthData = 5;
        const length = /^[i]+$/.test(search) ? search.length : 1;
        let start = length - Math.floor(fixedLengthData / 2);
        start = start < 1 ? 1 : start;
        const current = getRandomInt(Math.pow(10, start) - 1).toString();
        list = Array.from({ length: fixedLengthData }, (_, i) => {
          const display = current.padStart(start + i, "0");
          return {
            id: "i".repeat(start + i),
            display: `${t("core.formatingSeries.formats.number")} (${display})`
          };
        });
        if (/^[i]+$/.test(search)) {
          return list;
        }
      }
      return [...list, ...codeFormats].filter((x) => {
        const contains2 = data.format.includes(`@[${x.id}]`);
        return !contains2 && (x.display.toLowerCase().includes(search.toLowerCase()) || x.id.toLowerCase().includes(search.toLowerCase()));
      });
    },
    [codeFormats, data.format, t]
  );
  const formatingCode = useCallback(
    (format) => {
      format = format == null ? void 0 : format.replace(/@\[([^\]]+)\]/g, function(_, p1) {
        var _a;
        if (/^[i]+$/.test(p1)) {
          const current = getRandomInt(Math.pow(10, p1.length) - 1).toString();
          const display = current.padStart(p1.length, "0");
          return display;
        }
        const date = /* @__PURE__ */ new Date();
        switch (p1) {
          case "yyyy":
            return date.getFullYear();
          case "yy":
            return date.getFullYear().toString().slice(-2);
          case "mmmm":
            return date.toLocaleString("default", { month: "long" });
          case "mmm":
            return date.toLocaleString("default", { month: "short" });
          case "mm":
            return (date.getMonth() + 1).toString().padStart(2, "0");
          default:
            return formatingCode((_a = codeFormats.find((x) => x.id == p1)) == null ? void 0 : _a.value) ?? p1;
        }
      });
      return format;
    },
    [codeFormats]
  );
  const resultCode = useMemo(() => {
    return formatingCode(data.format);
  }, [data.format, formatingCode]);
  return /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsx(FormPageContent, { value: "detail", title: null, children: /* @__PURE__ */ jsxs("div", { className: "grid gap-x-3 gap-y-4", children: [
    /* @__PURE__ */ jsx(
      FormInput,
      {
        error,
        required: true,
        label: t("core.formatingSeries.columns.format"),
        children: /* @__PURE__ */ jsx(
          MentionsInput,
          {
            singleLine: true,
            value: data.format ?? "",
            onChange: (_, value) => {
              setData("format", value);
              setError(checkError(value));
            },
            className: "mentions",
            allowSuggestionsAboveCursor: true,
            autoComplete: "off",
            placeholder: t("core.formatingSeries.placeholder"),
            children: /* @__PURE__ */ jsx(
              Mention,
              {
                markup: "@[__id__]",
                trigger: /(\{([^{]*))$/,
                data: getData,
                displayTransform: (id) => "{" + id + "}"
              }
            )
          }
        )
      }
    ),
    /* @__PURE__ */ jsx(FormInput, { label: t("core.formatingSeries.columns.example_result"), children: /* @__PURE__ */ jsx(Input, { disabled: true, value: resultCode }) })
  ] }) }) });
}
export {
  Show as default
};
