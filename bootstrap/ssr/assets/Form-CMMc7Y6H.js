import { jsxs, Fragment, jsx } from "react/jsx-runtime";
import { u as useFormPage, g as FormPageContent, a as FormInput, F as FormCheckbox, k as FormPageContentTitle, T as Textarea } from "./checkbox-C_BEU5E4.js";
import Form$1 from "./Form-B00usptC.js";
import { B as Button } from "./button-Us2TB7GG.js";
import CountryLinkModel from "./CountryLinkModel-sHdBSxco.js";
import { F as FormTable } from "./FormTable-8UNeAa3g.js";
import { I as Input } from "./input-wk3Ou7wI.js";
import "react";
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
import "radix-ui";
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
  const { t } = useLaravelReactI18n();
  const { data, setData } = useFormPage();
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs(
      FormPageContent,
      {
        title: t("sales.customer.customer_detail"),
        value: "customer_detail",
        children: [
          /* @__PURE__ */ jsx(
            FormInput,
            {
              label: t("sales.customer.columns.name"),
              required: true,
              name: "name",
              children: /* @__PURE__ */ jsx(
                Input,
                {
                  value: (data == null ? void 0 : data.name) ?? "",
                  onChange: (e) => setData("name", e.target.value)
                }
              )
            }
          ),
          /* @__PURE__ */ jsxs("div", { className: "grid pt-2 mt-4 gap-x-4 gap-y-4 md:grid-cols-3", children: [
            /* @__PURE__ */ jsx(FormInput, { label: t("sales.customer.columns.vat"), required: true, children: /* @__PURE__ */ jsx(
              Input,
              {
                type: "string",
                value: (data == null ? void 0 : data.vat) ?? "",
                onChange: (e) => setData("vat", e.target.value)
              }
            ) }),
            /* @__PURE__ */ jsx(FormInput, { label: t("sales.customer.columns.email"), required: true, children: /* @__PURE__ */ jsx(
              Input,
              {
                type: "email",
                value: (data == null ? void 0 : data.email) ?? "",
                onChange: (e) => setData("email", e.target.value)
              }
            ) }),
            /* @__PURE__ */ jsx(FormInput, { label: t("sales.customer.columns.phone"), required: true, children: /* @__PURE__ */ jsx(
              Input,
              {
                value: (data == null ? void 0 : data.phone) ?? "",
                onChange: (e) => setData("phone", e.target.value)
              }
            ) }),
            /* @__PURE__ */ jsx(
              FormCheckbox,
              {
                label: t("purchase.supplier.columns.is_disabled"),
                checked: data == null ? void 0 : data.is_disabled,
                onCheckedChange: (e) => setData("is_disabled", e)
              }
            )
          ] })
        ]
      }
    ),
    /* @__PURE__ */ jsxs(
      FormPageContent,
      {
        title: t("sales.customer.address"),
        value: "customer_detail",
        children: [
          /* @__PURE__ */ jsx(FormPageContentTitle, { children: t("sales.customer.address") }),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              label: t("sales.customer.columns.street"),
              required: true,
              className: "col-span-full",
              children: /* @__PURE__ */ jsx(
                Textarea,
                {
                  value: (data == null ? void 0 : data.street) ?? "",
                  onChange: (e) => setData("street", e.target.value)
                }
              )
            }
          ),
          /* @__PURE__ */ jsxs("div", { className: "grid pt-2 mt-4 gap-x-4 gap-y-4 md:grid-cols-3", children: [
            /* @__PURE__ */ jsx(FormInput, { label: t("sales.customer.columns.city"), required: true, children: /* @__PURE__ */ jsx(
              Input,
              {
                value: (data == null ? void 0 : data.city) ?? "",
                onChange: (e) => setData("city", e.target.value)
              }
            ) }),
            /* @__PURE__ */ jsx(
              FormInput,
              {
                label: t("sales.customer.columns.province"),
                required: true,
                children: /* @__PURE__ */ jsx(
                  Input,
                  {
                    value: (data == null ? void 0 : data.province) ?? "",
                    onChange: (e) => setData("province", e.target.value)
                  }
                )
              }
            ),
            /* @__PURE__ */ jsx(
              FormInput,
              {
                label: t("sales.customer.columns.zip_code"),
                required: true,
                children: /* @__PURE__ */ jsx(
                  Input,
                  {
                    value: (data == null ? void 0 : data.zip_code) ?? "",
                    onChange: (e) => setData("zip_code", e.target.value)
                  }
                )
              }
            ),
            /* @__PURE__ */ jsx(
              FormInput,
              {
                label: t("sales.customer.columns.country"),
                required: true,
                children: /* @__PURE__ */ jsx(
                  CountryLinkModel,
                  {
                    placeholder: t("sales.customer.columns.country.placeholder"),
                    value: data.country,
                    onValueChange: (val) => setData("country", val)
                  }
                )
              }
            )
          ] })
        ]
      }
    ),
    /* @__PURE__ */ jsx(FormPageContent, { title: t("sales.customer.branches"), value: "branches", children: /* @__PURE__ */ jsx(
      FormTable,
      {
        columns: [
          {
            name: "branch_name",
            title: t("sales.customer.columns.branch_name"),
            required: true,
            cell: ({ dataRow, openDialog, isEmpty }) => {
              if (dataRow.is_main_branch) {
                return /* @__PURE__ */ jsx("div", { className: "flex self-start justify-start px-4 py-2 custom-cell", children: /* @__PURE__ */ jsxs("p", { children: [
                  dataRow.name,
                  " (Main Branch)"
                ] }) });
              }
              return /* @__PURE__ */ jsx("div", { className: "flex self-start justify-start px-4 py-2 custom-cell", children: isEmpty ? /* @__PURE__ */ jsx(
                Button,
                {
                  size: "sm",
                  className: "h-8",
                  onClick: openDialog,
                  type: "button",
                  children: t("core.branch.add_branch")
                }
              ) : /* @__PURE__ */ jsx(
                "p",
                {
                  className: "cursor-pointer hover:underline",
                  onClick: openDialog,
                  children: dataRow.name ?? t("core.branch.empty")
                }
              ) });
            }
          }
        ],
        submitable: true,
        defaultValueRow: {
          branchable_type: "App\\Models\\Sales\\Customer"
        },
        value: data.branches ?? [],
        onValueChange: (val) => {
          setData("branches", val);
        },
        form: /* @__PURE__ */ jsx(Form$1, {})
      }
    ) })
  ] });
}
export {
  Form as default
};
