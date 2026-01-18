import { jsx, Fragment, jsxs } from "react/jsx-runtime";
import { u as useFormPage, g as FormPageContent, F as FormCheckbox, a as FormInput } from "./checkbox-C_BEU5E4.js";
import ItemVariantLinkModel from "./ItemVariantLinkModel-bx0YsOm5.js";
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
import "./Form-a_UJAbx0.js";
import "./Mention-CB0VqwkR.js";
import "react-mentions";
import "./AttributeLinkModel-ED6Z3erq.js";
import "./Form-Cvx0UpcU.js";
import "./FormTable-8UNeAa3g.js";
import "@dnd-kit/core";
import "@dnd-kit/sortable";
import "@dnd-kit/utilities";
import "./CurrencyInput-DtXsGVaN.js";
import "./useDynamicRefs-DuDlSZ7v.js";
import "./FormBarcodes-BWe8Q1fd.js";
import "./UnitLinkModel-2m6CkvAO.js";
import "./Form-C_ygZCFM.js";
import "./Combobox-CnMmTQqc.js";
import "./drawer-D3vDykaS.js";
import "vaul";
import "./FormDetail-Qe3HBKif.js";
import "./CategoryLinkModel-BHkXUdr5.js";
import "./Form-CjyI6LgW.js";
import "./FormStockLevels-Dn2rbyo9.js";
function Form() {
  var _a, _b;
  const { data, setData } = useFormPage();
  const { t } = useLaravelReactI18n();
  return /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsx(FormPageContent, { title: null, value: "detail", children: /* @__PURE__ */ jsxs("div", { className: "grid gap-x-3 gap-y-4", children: [
    /* @__PURE__ */ jsx(
      FormCheckbox,
      {
        checked: data.two_way,
        onCheckedChange: (val) => setData("two_way", val),
        label: t("inventory.itemAlternative.columns.two_way")
      }
    ),
    /* @__PURE__ */ jsx(
      FormInput,
      {
        required: true,
        label: t("inventory.itemAlternative.columns.item"),
        children: /* @__PURE__ */ jsx(
          ItemVariantLinkModel,
          {
            placeholder: t(
              "inventory.itemAlternative.columns.item.placeholder"
            ),
            filters: {
              or: {
                allow_alternative_item: true,
                item: { allow_alternative_item: true }
              }
            },
            value: data.item,
            onValueChange: (val) => setData("item", val)
          }
        )
      }
    ),
    /* @__PURE__ */ jsx(
      FormInput,
      {
        required: true,
        label: t("inventory.itemAlternative.columns.alternative"),
        children: /* @__PURE__ */ jsx(
          ItemVariantLinkModel,
          {
            placeholder: t(
              "inventory.itemAlternative.columns.alternative.placeholder"
            ),
            filters: {
              ...data.two_way ? {
                or: {
                  allow_alternative_item: true,
                  item: { allow_alternative_item: true }
                }
              } : {},
              id: {
                not: (_a = data.item) == null ? void 0 : _a.id
              },
              category_id: (_b = data.item) == null ? void 0 : _b.category_id
            },
            value: data.alternative,
            onValueChange: (val) => setData("alternative", val)
          }
        )
      }
    )
  ] }) }) });
}
export {
  Form as default
};
