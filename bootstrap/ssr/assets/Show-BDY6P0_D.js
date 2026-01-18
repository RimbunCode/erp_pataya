import { jsx } from "react/jsx-runtime";
import "./ToggleTheme-BSs-sHS2.js";
import "./button-Us2TB7GG.js";
import { F as Form } from "./AccountLinkModel-DI4EpSiA.js";
import { h as FormPage } from "./checkbox-C_BEU5E4.js";
import "./Link-p0Z4AKax.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";
import "@radix-ui/react-dropdown-menu";
import "react";
import "lucide-react";
import "./utils-ClCZGsDL.js";
import "date-fns/locale";
import "lodash";
import "buffer";
import "clsx";
import "tailwind-merge";
import "./MasterLayout-CRsmljQs.js";
import "@radix-ui/react-alert-dialog";
import "./use-mobile-BsFue-bT.js";
import "sonner";
import "zustand";
import "./tooltip-Df8khweJ.js";
import "@radix-ui/react-tooltip";
import "radix-ui";
import "class-variance-authority";
import "./CurrencyInput-DtXsGVaN.js";
import "./input-wk3Ou7wI.js";
import "./Select-DB9toH_t.js";
import "./command-BSnyCa9u.js";
import "@radix-ui/react-dialog";
import "cmdk";
import "./popover-CziqY8mR.js";
import "@radix-ui/react-popover";
import "react-detect-click-outside";
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
import "@radix-ui/react-accordion";
import "qs";
import "@radix-ui/react-progress";
import "@headlessui/react";
import "./Comments-Bvo3255G.js";
import "quill-mention/autoregister";
import "quill";
import "@date-fns/tz";
import "date-fns";
import "@inertiajs/core";
import "@remixicon/react";
import "./Tags-D6pM3ZUY.js";
import "@marcbachmann/cel-js";
function Show({ account }) {
  const { t } = useLaravelReactI18n();
  const loadFrom = usePage().props.loadFrom;
  return /* @__PURE__ */ jsx(
    FormPage,
    {
      isCreate: !account,
      ignoreDraft: loadFrom,
      name: "account",
      title: account ? account.code : t("finance.account.new"),
      disabled: account == null ? void 0 : account.have_transactions,
      children: /* @__PURE__ */ jsx(Form, {})
    }
  );
}
export {
  Show as default
};
