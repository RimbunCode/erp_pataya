import { jsxs, jsx } from "react/jsx-runtime";
import CategoryLinkModel from "./CategoryLinkModel-BHkXUdr5.js";
import { g as FormPageContent, F as FormCheckbox, a as FormInput, T as Textarea } from "./checkbox-C_BEU5E4.js";
import { I as Input } from "./input-wk3Ou7wI.js";
import "react";
import UnitLinkModel from "./UnitLinkModel-2m6CkvAO.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
import "./Form-CjyI6LgW.js";
import "./Select-DB9toH_t.js";
import "./command-BSnyCa9u.js";
import "@radix-ui/react-dialog";
import "lucide-react";
import "./utils-ClCZGsDL.js";
import "date-fns/locale";
import "lodash";
import "buffer";
import "clsx";
import "tailwind-merge";
import "./use-mobile-BsFue-bT.js";
import "cmdk";
import "./popover-CziqY8mR.js";
import "@radix-ui/react-popover";
import "./tooltip-Df8khweJ.js";
import "@radix-ui/react-tooltip";
import "./button-Us2TB7GG.js";
import "radix-ui";
import "class-variance-authority";
import "react-detect-click-outside";
import "@radix-ui/react-checkbox";
import "./MasterLayout-CRsmljQs.js";
import "@radix-ui/react-alert-dialog";
import "@inertiajs/react";
import "sonner";
import "zustand";
import "./Link-p0Z4AKax.js";
import "@inertiajs/core";
import "./avatar-_KK8H2Pc.js";
import "@radix-ui/react-avatar";
import "./AppLayout-Drqdr6Z-.js";
import "@radix-ui/react-separator";
import "./skeleton-IN0PLOYc.js";
import "@radix-ui/react-slot";
import "./ToggleTheme-BSs-sHS2.js";
import "@radix-ui/react-dropdown-menu";
import "./LoadingIcon-CRleOEtX.js";
import "axios";
import "pluralize";
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
import "./Form-C_ygZCFM.js";
import "./Combobox-CnMmTQqc.js";
import "./drawer-D3vDykaS.js";
import "vaul";
function FormDetail({
  dataBefore,
  data,
  setData,
  isVariant,
  item
}) {
  const { t } = useLaravelReactI18n();
  return /* @__PURE__ */ jsxs(FormPageContent, { title: t("inventory.item.menu.details"), value: "detail", children: [
    /* @__PURE__ */ jsxs("div", { className: "columns-xs space-y-4 [&>div]:break-inside-avoid", children: [
      /* @__PURE__ */ jsx(
        FormCheckbox,
        {
          checked: isVariant ? data.is_disabled ?? "indeterminate" : data.is_disabled,
          onCheckedChange: (val) => {
            if (isVariant) {
              setData(
                "is_disabled",
                data.is_disabled === false ? null : data.is_disabled == null ? true : false
              );
              return;
            }
            setData("is_disabled", val);
          },
          label: t("inventory.item.columns.is_disabled.parse.true")
        }
      ),
      /* @__PURE__ */ jsx(
        FormCheckbox,
        {
          checked: isVariant ? data.allow_alternative_item ?? "indeterminate" : data.allow_alternative_item,
          onCheckedChange: (val) => {
            if (isVariant) {
              setData(
                "allow_alternative_item",
                data.allow_alternative_item === false ? null : data.allow_alternative_item == null ? true : false
              );
              return;
            }
            setData("allow_alternative_item", val);
          },
          label: t("inventory.item.columns.allow_alternative_item")
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "mt-4 space-y-4 gap-x-8 columns-xs [&>div]:break-inside-avoid", children: [
      /* @__PURE__ */ jsx(
        FormInput,
        {
          required: true,
          label: t(`inventory.item.columns.${isVariant ? "sku" : "code"}`),
          className: "",
          children: /* @__PURE__ */ jsx(
            Input,
            {
              disabled: isVariant,
              value: isVariant ? data.sku : data.code,
              name: "code",
              onChange: (e) => setData("code", e.target.value)
            }
          )
        }
      ),
      /* @__PURE__ */ jsx(
        FormInput,
        {
          required: true,
          label: t("inventory.item.columns.name"),
          className: "",
          children: /* @__PURE__ */ jsx(
            Input,
            {
              disabled: isVariant,
              name: "name",
              value: isVariant ? item.name : data.name,
              onChange: (e) => setData("name", e.target.value)
            }
          )
        }
      ),
      /* @__PURE__ */ jsx(FormInput, { required: true, label: t("inventory.item.columns.category"), children: /* @__PURE__ */ jsx(
        CategoryLinkModel,
        {
          placeholder: t("inventory.item.columns.category.placeholder"),
          disabled: isVariant,
          value: isVariant ? item.category : data.category,
          onValueChange: (val) => setData("category", val),
          filters: !isVariant && data.have_transations ? {
            type: {
              in: ["stock", "vehicle"]
            }
          } : null
        }
      ) }),
      /* @__PURE__ */ jsx(
        FormInput,
        {
          required: true,
          label: t("inventory.item.columns.default_unit"),
          children: /* @__PURE__ */ jsx(
            UnitLinkModel,
            {
              readOnly: isVariant ? item.have_transations : data.have_transations,
              placeholder: t("inventory.item.columns.default_unit.placeholder"),
              disabled: isVariant,
              value: isVariant ? item.default_unit : data.default_unit,
              onValueChange: (val) => setData("default_unit", val)
            }
          )
        }
      )
    ] }),
    /* @__PURE__ */ jsx(
      FormInput,
      {
        label: t("inventory.item.columns.description"),
        className: "mt-4",
        children: /* @__PURE__ */ jsx(
          Textarea,
          {
            name: "description",
            value: (data == null ? void 0 : data.description) ?? (item == null ? void 0 : item.description) ?? "",
            onChange: (e) => setData("description", e.target.value)
          }
        )
      }
    )
  ] });
}
export {
  FormDetail as default
};
