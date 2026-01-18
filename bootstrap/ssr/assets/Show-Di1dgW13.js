import { jsx, jsxs } from "react/jsx-runtime";
import { w as isValidStatus, l as inArray, v as calculateArray } from "./utils-ClCZGsDL.js";
import { B as Button } from "./button-Us2TB7GG.js";
import Form from "./Form-Cs7GUWkn.js";
import { h as FormPage } from "./checkbox-C_BEU5E4.js";
import { L as Link } from "./Link-p0Z4AKax.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
import "react";
import "date-fns/locale";
import "lodash";
import "buffer";
import "clsx";
import "tailwind-merge";
import "lucide-react";
import "radix-ui";
import "class-variance-authority";
import "./BranchLinkModel-C7QCrxBS.js";
import "./Form-B00usptC.js";
import "./CountryLinkModel-sHdBSxco.js";
import "@radix-ui/react-checkbox";
import "./MasterLayout-CRsmljQs.js";
import "@radix-ui/react-alert-dialog";
import "./use-mobile-BsFue-bT.js";
import "@inertiajs/react";
import "sonner";
import "zustand";
import "./tooltip-Df8khweJ.js";
import "@radix-ui/react-tooltip";
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
import "./DeliveryNoteLinkModel-De2hL7n7.js";
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
import "./PermissionLinkModel-Cy7R6yf4.js";
import "./WarehouseLinkModel-CvfxArBc.js";
import "./Form-BsjjUTga.js";
import "./UserLinkModel-Dt8-ovm1.js";
function Show({ deliveryNote, defaultData, flash }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;
  return /* @__PURE__ */ jsx(
    FormPage,
    {
      isCreate: !deliveryNote,
      name: "deliveryNote",
      title: deliveryNote ? deliveryNote.code : t("inventory.deliveryNote.new"),
      disabled: deliveryNote == null ? void 0 : deliveryNote.submitted_at,
      submitable: true,
      ignoreDraft: defaultData,
      defaultValues: defaultData,
      banner: flash.errorItems && /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-x-2 text-sm alert error p-4", children: [
        /* @__PURE__ */ jsx("h3", { className: "text-base font-semibold", children: t("core.form.errors.title") }),
        /* @__PURE__ */ jsx("ul", { className: "block pl-5", children: flash.errorItems.map((value, index) => /* @__PURE__ */ jsx("li", { className: "list-disc", children: t(value) }, index)) })
      ] }),
      controls: () => {
        if ((deliveryNote == null ? void 0 : deliveryNote.submitted_at) && isValidStatus(deliveryNote == null ? void 0 : deliveryNote.status) && inArray(deliveryNote == null ? void 0 : deliveryNote.status, "delivered") && calculateArray(deliveryNote == null ? void 0 : deliveryNote.items, "remaining_quantity", "+") > 0) {
          return /* @__PURE__ */ jsx(
            Button,
            {
              type: "button",
              className: "p-2! size-fit h-8",
              variant: "secondary",
              asChild: true,
              children: /* @__PURE__ */ jsx(
                Link,
                {
                  href: route("deliveryNotes.create", {
                    ref: `deliveryNote/${deliveryNote == null ? void 0 : deliveryNote.id}`
                  }),
                  children: t("inventory.deliveryNote.actions.create_sales_return")
                }
              )
            }
          );
        }
      },
      children: /* @__PURE__ */ jsx(Form, {})
    }
  );
}
export {
  Show as default
};
