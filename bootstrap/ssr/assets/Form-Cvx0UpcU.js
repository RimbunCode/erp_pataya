import { jsx, Fragment, jsxs } from "react/jsx-runtime";
import { u as useFormPage, g as FormPageContent, a as FormInput, T as Textarea, F as FormCheckbox } from "./checkbox-C_BEU5E4.js";
import { useMemo } from "react";
import { F as FormTable } from "./FormTable-8UNeAa3g.js";
import { I as Input } from "./input-wk3Ou7wI.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
import "@radix-ui/react-checkbox";
import "lucide-react";
import "./utils-ClCZGsDL.js";
import "date-fns/locale";
import "lodash";
import "buffer";
import "clsx";
import "tailwind-merge";
import "class-variance-authority";
import "./MasterLayout-CRsmljQs.js";
import "@radix-ui/react-alert-dialog";
import "./button-Us2TB7GG.js";
import "radix-ui";
import "./use-mobile-BsFue-bT.js";
import "@inertiajs/react";
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
import "@remixicon/react";
import "./Tags-D6pM3ZUY.js";
import "@marcbachmann/cel-js";
import "@dnd-kit/core";
import "@dnd-kit/sortable";
import "@dnd-kit/utilities";
import "./CurrencyInput-DtXsGVaN.js";
import "./useDynamicRefs-DuDlSZ7v.js";
function Form() {
  const { data, setData } = useFormPage();
  const { t } = useLaravelReactI18n();
  const valuesColumns = useMemo(
    () => [
      {
        name: "value",
        titleTrans: "inventory.attribute.columns.value",
        required: true
      }
    ],
    []
  );
  return /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsx(FormPageContent, { title: null, value: "detail", children: /* @__PURE__ */ jsxs("div", { className: "grid gap-x-3 gap-y-4 lg:grid-cols-3", children: [
    /* @__PURE__ */ jsx(
      FormInput,
      {
        required: true,
        label: t("inventory.attribute.columns.name"),
        className: "col-span-full",
        children: /* @__PURE__ */ jsx(
          Input,
          {
            value: data.name,
            onChange: (e) => setData("name", e.target.value)
          }
        )
      }
    ),
    /* @__PURE__ */ jsx(
      FormInput,
      {
        label: t("inventory.attribute.columns.description"),
        className: "col-span-full",
        children: /* @__PURE__ */ jsx(
          Textarea,
          {
            value: data.description ?? "",
            onChange: (e) => setData("description", e.target.value)
          }
        )
      }
    ),
    /* @__PURE__ */ jsx(
      FormCheckbox,
      {
        checked: data.is_numeric ?? false,
        onCheckedChange: (val) => {
          setData("is_numeric", val);
        },
        label: t("inventory.attribute.columns.is_numeric"),
        className: "col-span-full"
      }
    ),
    !data.is_numeric ? /* @__PURE__ */ jsx(
      FormTable,
      {
        label: t("inventory.attribute.columns.values"),
        className: "col-span-full",
        columns: valuesColumns,
        value: data.values ?? [],
        onValueChange: (val) => {
          setData("values", val);
        }
      }
    ) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(
        FormInput,
        {
          required: true,
          label: t("inventory.attribute.columns.range.from"),
          children: /* @__PURE__ */ jsx(
            Input,
            {
              type: "number",
              value: data.from_range ?? 0,
              onChange: (e) => setData("from_range", e.target.value)
            }
          )
        }
      ),
      /* @__PURE__ */ jsx(
        FormInput,
        {
          required: true,
          label: t("inventory.attribute.columns.range.to"),
          children: /* @__PURE__ */ jsx(
            Input,
            {
              type: "number",
              value: data.to_range ?? 0,
              onChange: (e) => setData("to_range", e.target.value)
            }
          )
        }
      ),
      /* @__PURE__ */ jsx(
        FormInput,
        {
          required: true,
          label: t("inventory.attribute.columns.range.increment"),
          children: /* @__PURE__ */ jsx(
            Input,
            {
              type: "number",
              min: "0",
              value: data.increment ?? 0,
              onChange: (e) => setData("increment", e.target.value)
            }
          )
        }
      )
    ] })
  ] }) }) });
}
export {
  Form as default
};
