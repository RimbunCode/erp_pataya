import { jsx } from "react/jsx-runtime";
import Form from "./Form-DVznZ4Aa.js";
import { L as LinkModel } from "./checkbox-C_BEU5E4.js";
import { forwardRef } from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";
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
import "./PaymentMethodLinkModel-kqgzg9-Y.js";
import "./Form-DLossNJm.js";
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
import "@radix-ui/react-checkbox";
import "./MasterLayout-CRsmljQs.js";
import "@radix-ui/react-alert-dialog";
import "sonner";
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
import "./label-DiFvdPYz.js";
import "@radix-ui/react-label";
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
const PaymentTermLinkModel = forwardRef(function PaymentTermLinkModel2({ value, onValueChange, placeholder, ...props }, ref) {
  const { t } = useLaravelReactI18n();
  return /* @__PURE__ */ jsx(
    LinkModel,
    {
      placeholder,
      value,
      onValueChange,
      model: "App\\Models\\Finances\\PaymentTerm",
      titleDialog: t("finances.paymentTerm.new"),
      classNameDialog: "max-w-xl",
      form: /* @__PURE__ */ jsx(Form, {}),
      ...props,
      ref
    }
  );
});
export {
  PaymentTermLinkModel as default
};
