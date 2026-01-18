import { jsx } from "react/jsx-runtime";
import Form from "./Form-H-O7EOc8.js";
import { L as LinkModel } from "./checkbox-C_BEU5E4.js";
import { forwardRef } from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import "./AccountLinkModel-DI4EpSiA.js";
import "./CurrencyInput-DtXsGVaN.js";
import "./utils-ClCZGsDL.js";
import "date-fns/locale";
import "lodash";
import "buffer";
import "clsx";
import "tailwind-merge";
import "./Link-p0Z4AKax.js";
import "@inertiajs/core";
import "@inertiajs/react";
import "zustand";
import "./input-wk3Ou7wI.js";
import "class-variance-authority";
import "./Select-DB9toH_t.js";
import "./command-BSnyCa9u.js";
import "@radix-ui/react-dialog";
import "lucide-react";
import "./use-mobile-BsFue-bT.js";
import "cmdk";
import "./popover-CziqY8mR.js";
import "@radix-ui/react-popover";
import "./tooltip-Df8khweJ.js";
import "@radix-ui/react-tooltip";
import "./button-Us2TB7GG.js";
import "radix-ui";
import "react-detect-click-outside";
import "./DatetimePicker-C3h7-5Qi.js";
import "./select-XM4G_Lvw.js";
import "@radix-ui/react-select";
import "react-day-picker";
import "@radix-ui/react-scroll-area";
import "date-fns";
import "./FormTable-8UNeAa3g.js";
import "./MasterLayout-CRsmljQs.js";
import "@radix-ui/react-alert-dialog";
import "sonner";
import "@dnd-kit/core";
import "@dnd-kit/sortable";
import "@dnd-kit/utilities";
import "./label-DiFvdPYz.js";
import "@radix-ui/react-label";
import "./useDynamicRefs-DuDlSZ7v.js";
import "./ItemVariantLinkModel-bx0YsOm5.js";
import "./Form-a_UJAbx0.js";
import "./Mention-CB0VqwkR.js";
import "react-mentions";
import "./AttributeLinkModel-ED6Z3erq.js";
import "./Form-Cvx0UpcU.js";
import "@radix-ui/react-checkbox";
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
import "@radix-ui/react-accordion";
import "qs";
import "@radix-ui/react-progress";
import "@headlessui/react";
import "./Comments-Bvo3255G.js";
import "quill-mention/autoregister";
import "quill";
import "@date-fns/tz";
import "@remixicon/react";
import "./Tags-D6pM3ZUY.js";
import "@marcbachmann/cel-js";
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
import "./WarehouseLinkModel-CvfxArBc.js";
import "./Form-BsjjUTga.js";
import "./BranchLinkModel-C7QCrxBS.js";
import "./Form-B00usptC.js";
import "./CountryLinkModel-sHdBSxco.js";
import "./UserLinkModel-Dt8-ovm1.js";
const CategoryLinkModel = forwardRef(function CategoryLinkModel2({ value, onValueChange, placeholder, ...props }, ref) {
  const { t } = useLaravelReactI18n();
  return /* @__PURE__ */ jsx(
    LinkModel,
    {
      placeholder,
      value,
      onValueChange,
      model: "App\\Models\\Inventory\\Category",
      titleDialog: t("inventory.category.new"),
      classNameDialog: "max-w-xl",
      form: /* @__PURE__ */ jsx(Form, {}),
      ...props,
      ref
    }
  );
});
export {
  CategoryLinkModel as default
};
