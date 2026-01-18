import { jsx, Fragment, jsxs } from "react/jsx-runtime";
import { u as useFormPage, g as FormPageContent, k as FormPageContentTitle, a as FormInput } from "./checkbox-C_BEU5E4.js";
import { C as CurrencyInput } from "./CurrencyInput-DtXsGVaN.js";
import CurrencyLinkModel from "./CurrencyLinkModel-u95oYPuj.js";
import CustomerLinkModel from "./CustomerLinkModel-CDws3QaJ.js";
import { D as DatetimePicker } from "./DatetimePicker-C3h7-5Qi.js";
import PaymentMethodLinkModel from "./PaymentMethodLinkModel-kqgzg9-Y.js";
import "react";
import { S as Select } from "./Select-DB9toH_t.js";
import { S as SupplierLinkModel } from "./SupplierLinkModel-BxebTbNh.js";
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
import "./Form-CMMc7Y6H.js";
import "./Form-B00usptC.js";
import "./CountryLinkModel-sHdBSxco.js";
import "./FormTable-8UNeAa3g.js";
import "@dnd-kit/core";
import "@dnd-kit/sortable";
import "@dnd-kit/utilities";
import "./useDynamicRefs-DuDlSZ7v.js";
import "./select-XM4G_Lvw.js";
import "@radix-ui/react-select";
import "react-day-picker";
import "@radix-ui/react-scroll-area";
import "./Form-DLossNJm.js";
function Form() {
  const { data, setData } = useFormPage();
  const { t } = useLaravelReactI18n();
  return /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsxs(FormPageContent, { title: null, value: "detail", children: [
    /* @__PURE__ */ jsx(FormPageContentTitle, {}),
    /* @__PURE__ */ jsxs("div", { className: "grid md:grid-cols-2  gap-x-3 gap-y-4", children: [
      /* @__PURE__ */ jsx(
        FormInput,
        {
          required: true,
          label: t("finances.paymentEntry.columns.date"),
          children: /* @__PURE__ */ jsx(
            DatetimePicker,
            {
              type: "datetime",
              value: data == null ? void 0 : data.date,
              onValueChange: (val) => setData("date", val)
            }
          )
        }
      ),
      /* @__PURE__ */ jsx(
        FormInput,
        {
          required: true,
          label: t("finances.paymentEntry.columns.currency"),
          className: "col-start-1",
          children: /* @__PURE__ */ jsx(
            CurrencyLinkModel,
            {
              placeholder: t(
                "finances.paymentEntry.columns.currency.placeholder"
              ),
              value: data.currency,
              onValueChange: (val) => {
                setData("currency", val);
              }
            }
          )
        }
      ),
      /* @__PURE__ */ jsx(
        FormInput,
        {
          required: true,
          label: t("finances.paymentEntry.columns.exchange_rate"),
          children: /* @__PURE__ */ jsx(
            CurrencyInput,
            {
              disabled: !data.currency,
              className: "text-left",
              value: data.exchange_rate,
              onValueChange: (val) => setData("exchange_rate", val)
            }
          )
        }
      ),
      /* @__PURE__ */ jsx(
        FormInput,
        {
          className: "col-start-1",
          required: true,
          label: t("finances.paymentEntry.columns.payment_type"),
          children: /* @__PURE__ */ jsx(
            Select,
            {
              readOnly: true,
              placeholder: t(
                "finances.paymentEntry.columns.payment_type.placeholder"
              ),
              optionTrans: "finances.paymentEntry.columns.payment_type.options",
              options: ["receive", "pay"],
              value: data.payment_type,
              onValueChange: (val) => {
                setData({
                  payment_type: val,
                  partyable_type: val === "receive" ? "App\\Models\\Sales\\Customer" : val === "pay" ? "App\\Models\\Purchase\\Supplier" : null
                });
              }
            }
          )
        }
      ),
      data.payment_type && /* @__PURE__ */ jsx(
        FormInput,
        {
          required: true,
          disabled: !data.payment_type,
          label: t("finances.paymentEntry.columns.party"),
          children: data.payment_type === "receive" ? /* @__PURE__ */ jsx(
            CustomerLinkModel,
            {
              value: data.partyable,
              onValueChange: (val) => setData("partyable", val),
              placeholder: t(
                "finances.paymentEntry.columns.party.placeholder"
              )
            }
          ) : /* @__PURE__ */ jsx(
            SupplierLinkModel,
            {
              value: data.partyable,
              onValueChange: (val) => setData("partyable", val),
              placeholder: t(
                "finances.paymentEntry.columns.party.placeholder"
              )
            }
          )
        }
      ),
      /* @__PURE__ */ jsx(
        FormInput,
        {
          className: "col-start-1",
          required: true,
          label: t("finances.paymentEntry.columns.payment_method"),
          children: /* @__PURE__ */ jsx(
            PaymentMethodLinkModel,
            {
              value: data.payment_method,
              onValueChange: (val) => setData("payment_method", val),
              placeholder: t(
                "finances.paymentEntry.columns.payment_method.placeholder"
              )
            }
          )
        }
      ),
      /* @__PURE__ */ jsx(
        FormInput,
        {
          required: true,
          label: t("finances.paymentEntry.columns.paid_amount"),
          children: /* @__PURE__ */ jsx(
            CurrencyInput,
            {
              className: "text-left",
              value: data.paid_amount,
              onValueChange: (val) => setData("paid_amount", val)
            }
          )
        }
      )
    ] })
  ] }) });
}
export {
  Form as default
};
