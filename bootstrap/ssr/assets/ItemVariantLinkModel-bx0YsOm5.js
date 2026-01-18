import { jsx } from "react/jsx-runtime";
import Form from "./Form-a_UJAbx0.js";
import { L as LinkModel } from "./checkbox-C_BEU5E4.js";
import { forwardRef } from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import "./Mention-CB0VqwkR.js";
import "react-mentions";
import "@inertiajs/react";
import "./AttributeLinkModel-ED6Z3erq.js";
import "./Form-Cvx0UpcU.js";
import "./FormTable-8UNeAa3g.js";
import "./MasterLayout-CRsmljQs.js";
import "@radix-ui/react-alert-dialog";
import "./button-Us2TB7GG.js";
import "lucide-react";
import "radix-ui";
import "./utils-ClCZGsDL.js";
import "date-fns/locale";
import "lodash";
import "buffer";
import "clsx";
import "tailwind-merge";
import "class-variance-authority";
import "./use-mobile-BsFue-bT.js";
import "sonner";
import "zustand";
import "./tooltip-Df8khweJ.js";
import "@radix-ui/react-tooltip";
import "./Link-p0Z4AKax.js";
import "@inertiajs/core";
import "./command-BSnyCa9u.js";
import "@radix-ui/react-dialog";
import "cmdk";
import "@dnd-kit/core";
import "@dnd-kit/sortable";
import "@dnd-kit/utilities";
import "./CurrencyInput-DtXsGVaN.js";
import "./input-wk3Ou7wI.js";
import "./label-DiFvdPYz.js";
import "@radix-ui/react-label";
import "./useDynamicRefs-DuDlSZ7v.js";
import "./FormBarcodes-BWe8Q1fd.js";
import "./UnitLinkModel-2m6CkvAO.js";
import "./Form-C_ygZCFM.js";
import "./Combobox-CnMmTQqc.js";
import "./drawer-D3vDykaS.js";
import "vaul";
import "./popover-CziqY8mR.js";
import "@radix-ui/react-popover";
import "qs";
import "axios";
import "./FormDetail-Qe3HBKif.js";
import "./CategoryLinkModel-BHkXUdr5.js";
import "./Form-CjyI6LgW.js";
import "./Select-DB9toH_t.js";
import "react-detect-click-outside";
import "./FormStockLevels-Dn2rbyo9.js";
import "./LoadingIcon-CRleOEtX.js";
import "@radix-ui/react-checkbox";
import "./avatar-_KK8H2Pc.js";
import "@radix-ui/react-avatar";
import "./AppLayout-Drqdr6Z-.js";
import "@radix-ui/react-separator";
import "./skeleton-IN0PLOYc.js";
import "@radix-ui/react-slot";
import "./ToggleTheme-BSs-sHS2.js";
import "@radix-ui/react-dropdown-menu";
import "pluralize";
import "./tabs-DhZjhdeH.js";
import "@radix-ui/react-tabs";
import "./InputError-2JjWc6nJ.js";
import "@radix-ui/react-accordion";
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
const ItemVariantLinkModel = forwardRef(function ItemVariantLinkModel2({ value, onValueChange, placeholder, ...props }, ref) {
  const { t } = useLaravelReactI18n();
  return /* @__PURE__ */ jsx(
    LinkModel,
    {
      placeholder,
      value,
      onValueChange,
      model: "App\\Models\\Inventory\\ItemVariant",
      titleDialog: t("inventory.item.new"),
      classNameDialog: "max-w-6xl",
      form: /* @__PURE__ */ jsx(Form, {}),
      as: "item:item_id",
      ...props,
      ref
    }
  );
});
export {
  ItemVariantLinkModel as default
};
