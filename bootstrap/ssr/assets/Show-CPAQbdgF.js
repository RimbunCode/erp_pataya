import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { D as DropdownMenu, a as DropdownMenuTrigger, b as DropdownMenuContent, c as DropdownMenuItem } from "./ToggleTheme-BSs-sHS2.js";
import { w as isValidStatus, l as inArray } from "./utils-ClCZGsDL.js";
import { B as Button } from "./button-Us2TB7GG.js";
import { ChevronsUpDown } from "lucide-react";
import Form from "./Form-C0npCoOp.js";
import { h as FormPage } from "./checkbox-C_BEU5E4.js";
import { L as Link } from "./Link-p0Z4AKax.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
import "@radix-ui/react-dropdown-menu";
import "react";
import "./MasterLayout-CRsmljQs.js";
import "@radix-ui/react-alert-dialog";
import "./use-mobile-BsFue-bT.js";
import "@inertiajs/react";
import "sonner";
import "zustand";
import "./tooltip-Df8khweJ.js";
import "@radix-ui/react-tooltip";
import "date-fns/locale";
import "lodash";
import "buffer";
import "clsx";
import "tailwind-merge";
import "radix-ui";
import "class-variance-authority";
import "./SelectModel-DOp7Mr8l.js";
import "./command-BSnyCa9u.js";
import "@radix-ui/react-dialog";
import "cmdk";
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
import "./input-wk3Ou7wI.js";
import "date-fns";
import "react-detect-click-outside";
import "@dnd-kit/utilities";
import "@dnd-kit/sortable";
import "./PermissionLinkModel-Cy7R6yf4.js";
import "@radix-ui/react-checkbox";
import "@inertiajs/core";
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
import "./BranchLinkModel-C7QCrxBS.js";
import "./Form-B00usptC.js";
import "./CountryLinkModel-sHdBSxco.js";
import "./CurrencyInput-DtXsGVaN.js";
import "./CurrencyLinkModel-u95oYPuj.js";
import "./CustomerLinkModel-CDws3QaJ.js";
import "./Form-CMMc7Y6H.js";
import "./FormTable-8UNeAa3g.js";
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
import "./PaymentSchedule-Bj4FhgiV.js";
import "./PaymentTermLinkModel-DeW-CCNL.js";
import "./Form-DVznZ4Aa.js";
import "./PaymentMethodLinkModel-kqgzg9-Y.js";
import "./Form-DLossNJm.js";
import "./SalesOrderLinkModel-DiJXrAI9.js";
import "./TaxLinkModel-DN-T_7Az.js";
import "./Form-DIGwfk9N.js";
import "./WarehouseLinkModel-CvfxArBc.js";
import "./Form-BsjjUTga.js";
import "./UserLinkModel-Dt8-ovm1.js";
function Show({ salesOrder, defaultData, flash }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;
  return /* @__PURE__ */ jsx(
    FormPage,
    {
      isCreate: !salesOrder,
      ignoreDraft: defaultData,
      name: "salesOrder",
      title: salesOrder ? salesOrder.code : t("sales.salesOrder.new"),
      disabled: salesOrder == null ? void 0 : salesOrder.submitted_at,
      submitable: true,
      defaultValues: defaultData,
      banner: flash.errorItems && /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-x-2 text-sm alert error p-4", children: [
        /* @__PURE__ */ jsx("h3", { className: "text-base font-semibold", children: t("core.form.errors.title") }),
        /* @__PURE__ */ jsx("ul", { className: "block pl-5", children: flash.errorItems.map((value, index) => /* @__PURE__ */ jsx("li", { className: "list-disc", children: t(value) }, index)) })
      ] }),
      controls: () => {
        if ((salesOrder == null ? void 0 : salesOrder.submitted_at) && isValidStatus(salesOrder == null ? void 0 : salesOrder.status) && inArray(salesOrder == null ? void 0 : salesOrder.status, [
          "to_bill",
          "to_deliver",
          "partially_paid",
          "partially_delivered"
        ])) {
          return /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsxs(DropdownMenu, { children: [
            /* @__PURE__ */ jsx(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxs(
              Button,
              {
                type: "button",
                className: "p-2! size-fit h-8",
                variant: "secondary",
                children: [
                  t("core.form.actions"),
                  /* @__PURE__ */ jsx(ChevronsUpDown, {})
                ]
              }
            ) }),
            /* @__PURE__ */ jsxs(DropdownMenuContent, { children: [
              inArray(salesOrder == null ? void 0 : salesOrder.status, [
                "to_bill",
                "partially_paid"
              ]) && /* @__PURE__ */ jsx(DropdownMenuItem, { asChild: true, children: /* @__PURE__ */ jsx(
                Link,
                {
                  href: route("salesInvoices.create", {
                    ref: salesOrder.id
                  }),
                  children: t("sales.salesOrder.actions.create_sales_invoice")
                }
              ) }),
              inArray(salesOrder == null ? void 0 : salesOrder.status, [
                "to_deliver",
                "partially_delivered"
              ]) && /* @__PURE__ */ jsx(DropdownMenuItem, { asChild: true, children: /* @__PURE__ */ jsx(
                Link,
                {
                  href: route("deliveryNotes.create", {
                    ref: `salesOrder/${salesOrder == null ? void 0 : salesOrder.id}`
                  }),
                  children: t("sales.salesOrder.actions.create_delivery_note")
                }
              ) })
            ] })
          ] }) });
        }
      },
      children: /* @__PURE__ */ jsx(Form, {})
    }
  );
}
export {
  Show as default
};
