import { jsx } from "react/jsx-runtime";
import Form from "./Form-V5XwpDQA.js";
import { L as LinkModel } from "./checkbox-C_BEU5E4.js";
import { forwardRef } from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import "./SelectModel-DOp7Mr8l.js";
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
import "./button-Us2TB7GG.js";
import "radix-ui";
import "class-variance-authority";
import "./Header-C9Xb62yg.js";
import "./select-XM4G_Lvw.js";
import "@radix-ui/react-select";
import "./Combobox-CnMmTQqc.js";
import "./drawer-D3vDykaS.js";
import "vaul";
import "./popover-CziqY8mR.js";
import "@radix-ui/react-popover";
import "./DatetimePicker-C3h7-5Qi.js";
import "react-day-picker";
import "@radix-ui/react-scroll-area";
import "@inertiajs/react";
import "./input-wk3Ou7wI.js";
import "date-fns";
import "react-detect-click-outside";
import "./Link-p0Z4AKax.js";
import "@inertiajs/core";
import "zustand";
import "./ToggleTheme-BSs-sHS2.js";
import "@radix-ui/react-dropdown-menu";
import "./MasterLayout-CRsmljQs.js";
import "@radix-ui/react-alert-dialog";
import "sonner";
import "./tooltip-Df8khweJ.js";
import "@radix-ui/react-tooltip";
import "@dnd-kit/utilities";
import "@dnd-kit/sortable";
import "./PermissionLinkModel-Cy7R6yf4.js";
import "@radix-ui/react-checkbox";
import "./avatar-_KK8H2Pc.js";
import "@radix-ui/react-avatar";
import "./AppLayout-Drqdr6Z-.js";
import "@radix-ui/react-separator";
import "./skeleton-IN0PLOYc.js";
import "@radix-ui/react-slot";
import "./LoadingIcon-CRleOEtX.js";
import "axios";
import "pluralize";
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
import "@remixicon/react";
import "./Tags-D6pM3ZUY.js";
import "@marcbachmann/cel-js";
import "./Table2-DWJgyKWG.js";
import "@dnd-kit/core";
import "./useDynamicRefs-DuDlSZ7v.js";
import "./CurrencyInput-DtXsGVaN.js";
import "./CurrencyLinkModel-u95oYPuj.js";
import "./FormTable-8UNeAa3g.js";
import "./ItemForm-DY08yeJA.js";
import "./ItemVariantLinkModel-bx0YsOm5.js";
import "./Form-a_UJAbx0.js";
import "./Mention-CB0VqwkR.js";
import "react-mentions";
import "./AttributeLinkModel-ED6Z3erq.js";
import "./Form-Cvx0UpcU.js";
import "./FormBarcodes-BWe8Q1fd.js";
import "./UnitLinkModel-2m6CkvAO.js";
import "./Form-C_ygZCFM.js";
import "./FormDetail-Qe3HBKif.js";
import "./CategoryLinkModel-BHkXUdr5.js";
import "./Form-CjyI6LgW.js";
import "./FormStockLevels-Dn2rbyo9.js";
import "./SupplierLinkModel-BxebTbNh.js";
import "./CountryLinkModel-sHdBSxco.js";
import "./WarehouseLinkModel-CvfxArBc.js";
import "./Form-BsjjUTga.js";
import "./BranchLinkModel-C7QCrxBS.js";
import "./Form-B00usptC.js";
import "./UserLinkModel-Dt8-ovm1.js";
import "./PaymentSchedule-Bj4FhgiV.js";
import "./PaymentTermLinkModel-DeW-CCNL.js";
import "./Form-DVznZ4Aa.js";
import "./PaymentMethodLinkModel-kqgzg9-Y.js";
import "./Form-DLossNJm.js";
import "./TaxLinkModel-DN-T_7Az.js";
import "./Form-DIGwfk9N.js";
const PurchaseOrderLinkModel = forwardRef(function PurchaseOrderLinkModel2({ value, onValueChange, placeholder, ...props }, ref) {
  const { t } = useLaravelReactI18n();
  return /* @__PURE__ */ jsx(
    LinkModel,
    {
      placeholder,
      value,
      onValueChange,
      model: "App\\Models\\Purchase\\PurchaseOrder",
      titleDialog: t("purchase.purchaseOrder.new"),
      classNameDialog: "max-w-xl",
      form: /* @__PURE__ */ jsx(Form, {}),
      ...props,
      ref
    }
  );
});
export {
  PurchaseOrderLinkModel as default
};
