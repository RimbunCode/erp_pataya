import { jsx, jsxs } from "react/jsx-runtime";
import Form from "./Form-C1sMfj0M.js";
import { h as FormPage } from "./checkbox-C_BEU5E4.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
import "react";
import "./BranchLinkModel-C7QCrxBS.js";
import "./Form-B00usptC.js";
import "./CountryLinkModel-sHdBSxco.js";
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
import "./CurrencyInput-DtXsGVaN.js";
import "./CurrencyLinkModel-u95oYPuj.js";
import "./CustomerLinkModel-CDws3QaJ.js";
import "./Form-CMMc7Y6H.js";
import "./FormTable-8UNeAa3g.js";
import "@dnd-kit/core";
import "@dnd-kit/sortable";
import "@dnd-kit/utilities";
import "./useDynamicRefs-DuDlSZ7v.js";
import "./DatetimePicker-C3h7-5Qi.js";
import "./select-XM4G_Lvw.js";
import "@radix-ui/react-select";
import "react-day-picker";
import "@radix-ui/react-scroll-area";
import "./ItemVariantLinkModel-bx0YsOm5.js";
import "./Form-a_UJAbx0.js";
import "./Mention-CB0VqwkR.js";
import "react-mentions";
import "./AttributeLinkModel-ED6Z3erq.js";
import "./Form-Cvx0UpcU.js";
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
import "./PaymentMethodLinkModel-kqgzg9-Y.js";
import "./Form-DLossNJm.js";
import "./PaymentTermLinkModel-DeW-CCNL.js";
import "./Form-DVznZ4Aa.js";
import "./SalesOrderLinkModel-DiJXrAI9.js";
import "./TaxLinkModel-DN-T_7Az.js";
import "./Form-DIGwfk9N.js";
import "./WarehouseLinkModel-CvfxArBc.js";
import "./Form-BsjjUTga.js";
import "./UserLinkModel-Dt8-ovm1.js";
import "./PaymentSchedule-Bj4FhgiV.js";
function Show({ salesInvoice, flash, defaultData }) {
  const { t } = useLaravelReactI18n();
  return /* @__PURE__ */ jsx(
    FormPage,
    {
      defaultValues: defaultData,
      isCreate: !salesInvoice,
      ignoreDraft: defaultData,
      name: "salesInvoice",
      title: salesInvoice ? salesInvoice.code : t("finances.salesInvoice.new"),
      disabled: salesInvoice == null ? void 0 : salesInvoice.submitted_at,
      submitable: true,
      banner: flash.errorItems && /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-x-2 text-sm alert error p-4", children: [
        /* @__PURE__ */ jsx("h3", { className: "text-base font-semibold", children: t("core.form.errors.title") }),
        /* @__PURE__ */ jsx("ul", { className: "block pl-5", children: flash.errorItems.map((value, index) => /* @__PURE__ */ jsx("li", { className: "list-disc", children: t(value) }, index)) })
      ] }),
      children: /* @__PURE__ */ jsx(Form, {})
    }
  );
}
export {
  Show as default
};
