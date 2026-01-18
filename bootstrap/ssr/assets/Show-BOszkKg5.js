import { jsx, Fragment, jsxs } from "react/jsx-runtime";
import { D as DropdownMenu, a as DropdownMenuTrigger, b as DropdownMenuContent, c as DropdownMenuItem } from "./ToggleTheme-BSs-sHS2.js";
import { c as cn } from "./utils-ClCZGsDL.js";
import { B as Button } from "./button-Us2TB7GG.js";
import Form from "./Form-CBsvsMDW.js";
import { h as FormPage } from "./checkbox-C_BEU5E4.js";
import { L as Link } from "./Link-p0Z4AKax.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useMemo } from "react";
import "@radix-ui/react-dropdown-menu";
import "lucide-react";
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
import "./CurrencyInput-DtXsGVaN.js";
import "./DatetimePicker-C3h7-5Qi.js";
import "./popover-CziqY8mR.js";
import "@radix-ui/react-popover";
import "./select-XM4G_Lvw.js";
import "@radix-ui/react-select";
import "react-day-picker";
import "@radix-ui/react-scroll-area";
import "./command-BSnyCa9u.js";
import "@radix-ui/react-dialog";
import "cmdk";
import "./input-wk3Ou7wI.js";
import "date-fns";
import "react-detect-click-outside";
import "./FormTable-8UNeAa3g.js";
import "@dnd-kit/core";
import "@dnd-kit/sortable";
import "@dnd-kit/utilities";
import "./label-DiFvdPYz.js";
import "@radix-ui/react-label";
import "./useDynamicRefs-DuDlSZ7v.js";
import "./ItemForm-e6Hygw4w.js";
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
import "./PurchaseOrderLinkModel-O-uRbF1B.js";
import "./Form-V5XwpDQA.js";
import "./SelectModel-DOp7Mr8l.js";
import "./Header-C9Xb62yg.js";
import "./PermissionLinkModel-Cy7R6yf4.js";
import "./Table2-DWJgyKWG.js";
import "./CurrencyLinkModel-u95oYPuj.js";
import "./ItemForm-DY08yeJA.js";
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
function Show({ purchaseReceipt, defaultData }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;
  const statusBadge = useMemo(() => {
    if (!purchaseReceipt) return;
    const status = t(`core.form.statuses.${purchaseReceipt == null ? void 0 : purchaseReceipt.status}`);
    return /* @__PURE__ */ jsx("span", { className: cn("text-sm badge capitalize"), children: status });
  }, [purchaseReceipt == null ? void 0 : purchaseReceipt.status, t]);
  return /* @__PURE__ */ jsx(
    FormPage,
    {
      isCreate: !purchaseReceipt,
      ignoreDraft: defaultData,
      name: "purchaseReceipt",
      title: purchaseReceipt ? purchaseReceipt.code : t("purchase.purchaseReceipt.new"),
      defaultValues: defaultData,
      disabled: ((purchaseReceipt == null ? void 0 : purchaseReceipt.status) ?? "draft") != "draft",
      submitable: true,
      badge: statusBadge,
      controls: () => {
        if (((purchaseReceipt == null ? void 0 : purchaseReceipt.status) ?? "draft") != "draft") {
          return /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsxs(DropdownMenu, { children: [
            /* @__PURE__ */ jsx(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsx(
              Button,
              {
                type: "button",
                className: "p-2! size-fit h-8",
                variant: "secondary",
                children: t("core.form.actions")
              }
            ) }),
            /* @__PURE__ */ jsx(DropdownMenuContent, { children: /* @__PURE__ */ jsx(DropdownMenuItem, { asChild: true, children: /* @__PURE__ */ jsx(
              Link,
              {
                href: route("purchaseOrders.create", {
                  ref: `purchaseReceipt/${purchaseReceipt == null ? void 0 : purchaseReceipt.id}`
                }),
                children: t("purchase.purchaseReceipt.actions.create_po")
              }
            ) }) })
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
