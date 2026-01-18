import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { D as DropdownMenu, a as DropdownMenuTrigger, b as DropdownMenuContent, c as DropdownMenuItem } from "./ToggleTheme-BSs-sHS2.js";
import { v as calculateArray, w as isValidStatus } from "./utils-ClCZGsDL.js";
import { B as Button } from "./button-Us2TB7GG.js";
import { ChevronsUpDownIcon } from "lucide-react";
import Form from "./Form-6eA6Z1By.js";
import { h as FormPage } from "./checkbox-C_BEU5E4.js";
import { L as Link } from "./Link-p0Z4AKax.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useMemo } from "react";
import "@radix-ui/react-dropdown-menu";
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
import "./BranchLinkModel-C7QCrxBS.js";
import "./Form-B00usptC.js";
import "./CountryLinkModel-sHdBSxco.js";
import "@radix-ui/react-checkbox";
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
import "./ItemForm-6udTT4rB.js";
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
function Show({ workOrder }) {
  const { t } = useLaravelReactI18n();
  const route = window.route;
  const canRequest = useMemo(() => {
    const totalRequiredQuantity = calculateArray(
      workOrder.items,
      "required_quantity"
    );
    return totalRequiredQuantity > 0;
  }, [workOrder]);
  return /* @__PURE__ */ jsx(
    FormPage,
    {
      name: "workOrder",
      title: workOrder.code,
      disabled: workOrder == null ? void 0 : workOrder.submitted_at,
      submitable: true,
      controls: ({ form }) => {
        var _a;
        if (!((workOrder == null ? void 0 : workOrder.submitted_at) && isValidStatus(workOrder == null ? void 0 : workOrder.status))) {
          return null;
        }
        return /* @__PURE__ */ jsxs(Fragment, { children: [
          workOrder.submitted_at && !workOrder.complated_at && /* @__PURE__ */ jsx(
            Button,
            {
              type: "button",
              className: "p-2! size-fit h-8 items-center flex",
              onClick: (e) => {
                e.preventDefault();
                e.stopPropagation();
                form.put(
                  route("workOrders.update", {
                    workOrder: workOrder.id,
                    level: workOrder.started_at ? "complate" : "start"
                  })
                );
              },
              children: t(
                workOrder.started_at ? "service.workOrder.actions.complate_work" : "service.workOrder.actions.start_work"
              )
            }
          ),
          !((_a = workOrder.additional_data) == null ? void 0 : _a.order) && /* @__PURE__ */ jsxs(DropdownMenu, { children: [
            /* @__PURE__ */ jsx(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxs(
              Button,
              {
                type: "button",
                className: "p-2! size-fit h-8 items-center flex",
                variant: "secondary",
                children: [
                  t("core.form.actions"),
                  /* @__PURE__ */ jsx(ChevronsUpDownIcon, {})
                ]
              }
            ) }),
            /* @__PURE__ */ jsxs(DropdownMenuContent, { children: [
              canRequest && /* @__PURE__ */ jsx(DropdownMenuItem, { asChild: true, children: /* @__PURE__ */ jsx(
                Link,
                {
                  href: route("purchaseRequests.create", {
                    ref: `workOrder/${workOrder.id}`
                  }),
                  preserveScroll: true,
                  preserveState: true,
                  replace: true,
                  children: t("service.workOrder.actions.create_pr")
                }
              ) }),
              /* @__PURE__ */ jsx(DropdownMenuItem, { asChild: true, children: /* @__PURE__ */ jsx(
                Link,
                {
                  href: route(
                    (workOrder == null ? void 0 : workOrder.for_internal) ? "internalOrders.create" : "salesOrders.create",
                    {
                      ref: `workOrder/${workOrder.id}`
                    }
                  ),
                  children: t(
                    "service.workOrder.actions." + ((workOrder == null ? void 0 : workOrder.for_internal) ? "create_io" : "create_so")
                  )
                }
              ) })
            ] })
          ] })
        ] });
      },
      children: /* @__PURE__ */ jsx(Form, {})
    }
  );
}
export {
  Show as default
};
