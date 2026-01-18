import { jsxs, Fragment, jsx } from "react/jsx-runtime";
import { u as useFormPage, g as FormPageContent, a as FormInput, F as FormCheckbox, T as Textarea, k as FormPageContentTitle } from "./checkbox-C_BEU5E4.js";
import CountryLinkModel from "./CountryLinkModel-sHdBSxco.js";
import { I as Input } from "./input-wk3Ou7wI.js";
import { memo } from "react";
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
const Form = memo(function Form2() {
  const { data, setData } = useFormPage();
  const { t } = useLaravelReactI18n();
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      FormPageContent,
      {
        title: t("core.branch.branch_detail"),
        value: "branch_detail",
        children: /* @__PURE__ */ jsxs("div", { className: "grid pt-2 gap-x-4 gap-y-4 md:grid-cols-2", children: [
          /* @__PURE__ */ jsx(
            FormInput,
            {
              label: t("core.branch.columns.code"),
              required: true,
              name: "code",
              children: /* @__PURE__ */ jsx(
                Input,
                {
                  value: data.code ?? "",
                  onChange: (e) => setData("code", e.target.value)
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              label: t("core.branch.columns.name"),
              required: true,
              name: "name",
              children: /* @__PURE__ */ jsx(
                Input,
                {
                  value: data.name ?? "",
                  onChange: (e) => setData("name", e.target.value)
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            FormCheckbox,
            {
              checked: data.is_disabled,
              onCheckedChange: (val) => {
                setData("is_disabled", val);
              },
              label: t("core.branch.columns.is_disabled.options.disabled"),
              className: "col-start-1 flex items-center **:pointer-events-auto!"
            }
          )
        ] })
      }
    ),
    /* @__PURE__ */ jsx(
      FormPageContent,
      {
        title: t(
          (data == null ? void 0 : data.branchable_type) ? "core.branch.columns.shipping_address" : "core.branch.columns.address"
        ),
        value: "branch_detail",
        children: /* @__PURE__ */ jsxs("div", { className: "grid pt-2 gap-x-4 gap-y-4 md:grid-cols-3", children: [
          /* @__PURE__ */ jsx(
            FormInput,
            {
              label: t("core.branch.columns.street"),
              required: true,
              className: "col-span-full",
              children: /* @__PURE__ */ jsx(
                Textarea,
                {
                  value: data.shipping_street ?? "",
                  onChange: (e) => setData("shipping_street", e.target.value)
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(FormInput, { label: t("core.branch.columns.city"), required: true, children: /* @__PURE__ */ jsx(
            Input,
            {
              value: data.shipping_city ?? "",
              onChange: (e) => setData("shipping_city", e.target.value)
            }
          ) }),
          /* @__PURE__ */ jsx(FormInput, { label: t("core.branch.columns.state"), required: true, children: /* @__PURE__ */ jsx(
            Input,
            {
              value: data.shipping_state ?? "",
              onChange: (e) => setData("shipping_state", e.target.value)
            }
          ) }),
          /* @__PURE__ */ jsx(FormInput, { label: t("core.branch.columns.zip_code"), required: true, children: /* @__PURE__ */ jsx(
            Input,
            {
              value: data.shipping_zip_code ?? "",
              onChange: (e) => setData("shipping_zip_code", e.target.value)
            }
          ) }),
          /* @__PURE__ */ jsx(FormInput, { label: t("core.branch.columns.country"), required: true, children: /* @__PURE__ */ jsx(
            CountryLinkModel,
            {
              placeholder: t("core.branch.columns.country.placeholder"),
              value: data.shipping_country ?? "",
              onValueChange: (val) => setData("shipping_country", val)
            }
          ) })
        ] })
      }
    ),
    (data == null ? void 0 : data.branchable_type) && /* @__PURE__ */ jsxs(
      FormPageContent,
      {
        title: t("core.branch.columns.billing_address"),
        value: "branch_detail",
        children: [
          /* @__PURE__ */ jsxs(FormPageContentTitle, { className: "flex items-center justify-between", children: [
            /* @__PURE__ */ jsx("h1", { className: "flex-1", children: t("core.branch.columns.billing_address") }),
            /* @__PURE__ */ jsx(
              Select,
              {
                required: true,
                value: data.billing_address,
                onValueChange: (val) => {
                  setData("billing_address", val);
                },
                placeholder: t("core.branch.columns.billing_address.placeholder"),
                optionTrans: "core.branch.columns.billing_address.options",
                options: ["same_main", "same_shipping", "separate"]
              }
            )
          ] }),
          (data == null ? void 0 : data.billing_address) == "separate" && /* @__PURE__ */ jsxs("div", { className: "grid pt-2 gap-x-4 gap-y-4 md:grid-cols-3", children: [
            /* @__PURE__ */ jsx(
              FormInput,
              {
                label: t("core.branch.columns.street"),
                required: true,
                className: "col-span-full",
                children: /* @__PURE__ */ jsx(
                  Textarea,
                  {
                    value: data.billing_street ?? "",
                    onChange: (e) => setData("billing_street", e.target.value)
                  }
                )
              }
            ),
            /* @__PURE__ */ jsx(FormInput, { label: t("core.branch.columns.city"), required: true, children: /* @__PURE__ */ jsx(
              Input,
              {
                value: data.billing_city ?? "",
                onChange: (e) => setData("billing_city", e.target.value)
              }
            ) }),
            /* @__PURE__ */ jsx(FormInput, { label: t("core.branch.columns.state"), required: true, children: /* @__PURE__ */ jsx(
              Input,
              {
                value: data.billing_state ?? "",
                onChange: (e) => setData("billing_state", e.target.value)
              }
            ) }),
            /* @__PURE__ */ jsx(
              FormInput,
              {
                label: t("core.branch.columns.zip_code"),
                required: true,
                children: /* @__PURE__ */ jsx(
                  Input,
                  {
                    value: data.billing_zip_code ?? "",
                    onChange: (e) => setData("billing_zip_code", e.target.value)
                  }
                )
              }
            ),
            /* @__PURE__ */ jsx(
              FormInput,
              {
                label: t("core.branch.columns.country"),
                required: true,
                children: /* @__PURE__ */ jsx(
                  CountryLinkModel,
                  {
                    placeholder: t("core.branch.columns.country.placeholder"),
                    value: data.billing_country,
                    onValueChange: (val) => setData("billing_country", val)
                  }
                )
              }
            )
          ] })
        ]
      }
    )
  ] });
});
export {
  Form as default
};
