import { jsxs, Fragment, jsx } from "react/jsx-runtime";
import { u as useFormPage, g as FormPageContent, k as FormPageContentTitle, a as FormInput, T as Textarea } from "./checkbox-C_BEU5E4.js";
import { C as CurrencyInput } from "./CurrencyInput-DtXsGVaN.js";
import { I as Input } from "./input-wk3Ou7wI.js";
import PaymentMethodLinkModel from "./PaymentMethodLinkModel-kqgzg9-Y.js";
import "react";
import { S as Select } from "./Select-DB9toH_t.js";
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
import "./Form-DLossNJm.js";
function Form() {
  const { data, setData } = useFormPage();
  const { t } = useLaravelReactI18n();
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs(FormPageContent, { title: null, value: "detail", children: [
      /* @__PURE__ */ jsx(FormPageContentTitle, {}),
      /* @__PURE__ */ jsxs("div", { className: "grid md:grid-cols-2  gap-x-3 gap-y-4", children: [
        /* @__PURE__ */ jsx(
          FormInput,
          {
            required: true,
            label: t("finances.paymentTerm.columns.name"),
            children: /* @__PURE__ */ jsx(
              Input,
              {
                value: (data == null ? void 0 : data.name) ?? "",
                onChange: (e) => setData("name", e.target.value)
              }
            )
          }
        ),
        /* @__PURE__ */ jsx(
          FormInput,
          {
            required: true,
            label: t("finances.paymentTerm.columns.invoice_portion"),
            children: /* @__PURE__ */ jsx(
              CurrencyInput,
              {
                className: "text-left",
                value: (data == null ? void 0 : data.invoice_portion) ?? "",
                onValueChange: (value) => setData("invoice_portion", value),
                decimalsLimit: 2,
                suffix: "%",
                min: 0,
                max: 100
              }
            )
          }
        ),
        /* @__PURE__ */ jsx(
          FormInput,
          {
            required: true,
            label: t("finances.paymentTerm.columns.due_date_based_on"),
            children: /* @__PURE__ */ jsx(
              Select,
              {
                value: data.due_date_based_on,
                onValueChange: (val) => setData("due_date_based_on", val),
                placeholder: t(
                  "finances.paymentTerm.columns.due_date_based_on.placeholder"
                ),
                optionTrans: "finances.paymentTerm.columns.due_date_based_on.options",
                options: [
                  "days_after_invoice_date",
                  "weeks_after_invoice_week",
                  "months_after_invoice_month"
                ]
              }
            )
          }
        ),
        /* @__PURE__ */ jsx(
          FormInput,
          {
            required: true,
            disabled: !data.due_date_based_on,
            label: t(
              "finances.paymentTerm.columns.credit" + (data.due_date_based_on == "days_after_invoice_date" ? "_days" : data.due_date_based_on == "weeks_after_invoice_week" ? "_weeks" : "_months")
            ),
            children: /* @__PURE__ */ jsx(
              CurrencyInput,
              {
                className: "text-left",
                decimalsLimit: 0,
                placeholder: "0",
                value: (data == null ? void 0 : data.credit_period) ?? "",
                onValueChange: (value) => {
                  setData("credit_period", value);
                }
              }
            )
          }
        ),
        " ",
        /* @__PURE__ */ jsx(
          FormInput,
          {
            required: false,
            label: t("finances.paymentTerm.columns.payment_method"),
            children: /* @__PURE__ */ jsx(
              PaymentMethodLinkModel,
              {
                value: data.payment_method,
                onValueChange: (val) => setData("payment_method", val),
                placeholder: t(
                  "finances.paymentTerm.columns.payment_method.placeholder"
                )
              }
            )
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsx(
      FormPageContent,
      {
        title: t("finances.paymentTerm.discount_settings"),
        value: "detail",
        children: /* @__PURE__ */ jsxs("div", { className: "grid md:grid-cols-2  gap-x-3 gap-y-4", children: [
          /* @__PURE__ */ jsx(FormInput, { label: t("finances.paymentTerm.columns.discount_type"), children: /* @__PURE__ */ jsx(
            Select,
            {
              value: data.discount_type,
              onValueChange: (val) => setData("discount_type", val),
              placeholder: t(
                "finances.paymentTerm.columns.discount_type.placeholder"
              ),
              optionTrans: "finances.paymentTerm.columns.discount_type.options",
              options: ["percentage", "amount"]
            }
          ) }),
          data.discount_type && /* @__PURE__ */ jsx(
            FormInput,
            {
              label: t("finances.paymentTerm.columns.discount"),
              required: true,
              children: /* @__PURE__ */ jsx(
                CurrencyInput,
                {
                  className: "text-left",
                  value: data.discount,
                  onValueChange: (value) => setData("discount", value),
                  decimalsLimit: 2,
                  suffix: data.discount_type == "percentage" ? "%" : "",
                  min: 0,
                  max: 100
                }
              )
            }
          )
        ] })
      }
    ),
    /* @__PURE__ */ jsx(
      FormPageContent,
      {
        title: t("finances.paymentTerm.columns.description"),
        value: "detail",
        children: /* @__PURE__ */ jsx(
          Textarea,
          {
            value: (data == null ? void 0 : data.description) ?? "",
            onChange: (e) => setData("description", e.target.value)
          }
        )
      }
    )
  ] });
}
export {
  Form as default
};
