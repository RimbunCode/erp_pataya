import { jsx } from "react/jsx-runtime";
import Form from "./Form-TRZzA-uq.js";
import { h as FormPage } from "./checkbox-C_BEU5E4.js";
import "./CurrencyInput-DtXsGVaN.js";
import "react";
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
import "laravel-react-i18n";
import "./CurrencyLinkModel-u95oYPuj.js";
import "@radix-ui/react-checkbox";
import "lucide-react";
import "class-variance-authority";
import "./MasterLayout-CRsmljQs.js";
import "@radix-ui/react-alert-dialog";
import "./button-Us2TB7GG.js";
import "radix-ui";
import "./use-mobile-BsFue-bT.js";
import "sonner";
import "./tooltip-Df8khweJ.js";
import "@radix-ui/react-tooltip";
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
import "./CustomerLinkModel-CDws3QaJ.js";
import "./Form-CMMc7Y6H.js";
import "./Form-B00usptC.js";
import "./CountryLinkModel-sHdBSxco.js";
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
import "./PaymentMethodLinkModel-kqgzg9-Y.js";
import "./Form-DLossNJm.js";
import "./SupplierLinkModel-BxebTbNh.js";
function Show({
  paymentEntry,
  paymentable_type,
  paymentable_id,
  payment_type,
  partyable_type,
  partyable,
  currency,
  paid_amount,
  payment_method
}) {
  return /* @__PURE__ */ jsx(
    FormPage,
    {
      name: "paymentEntry",
      title: paymentEntry == null ? void 0 : paymentEntry.code,
      disabled: paymentEntry == null ? void 0 : paymentEntry.submitted_at,
      submitable: true,
      isCreate: !paymentEntry,
      ignoreDraft: paymentable_type,
      defaultValues: {
        paymentable_type,
        paymentable_id,
        payment_type,
        partyable_type,
        partyable,
        currency,
        date: /* @__PURE__ */ new Date(),
        paid_amount,
        payment_method
      },
      children: /* @__PURE__ */ jsx(Form, {})
    }
  );
}
export {
  Show as default
};
