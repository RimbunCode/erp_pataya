import { jsx } from "react/jsx-runtime";
import { u as useFormPage, g as FormPageContent } from "./checkbox-C_BEU5E4.js";
import "./select-XM4G_Lvw.js";
import "./command-BSnyCa9u.js";
import "./drawer-D3vDykaS.js";
import "./popover-CziqY8mR.js";
import "react";
import "./button-Us2TB7GG.js";
import "lodash";
import "buffer";
import "clsx";
import "./input-wk3Ou7wI.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
import "@inertiajs/react";
import { A as AccountLinkModel } from "./AccountLinkModel-DI4EpSiA.js";
import { F as FormTable } from "./FormTable-8UNeAa3g.js";
import "@radix-ui/react-checkbox";
import "lucide-react";
import "./utils-ClCZGsDL.js";
import "date-fns/locale";
import "tailwind-merge";
import "class-variance-authority";
import "./MasterLayout-CRsmljQs.js";
import "@radix-ui/react-alert-dialog";
import "./use-mobile-BsFue-bT.js";
import "sonner";
import "zustand";
import "./tooltip-Df8khweJ.js";
import "@radix-ui/react-tooltip";
import "./Link-p0Z4AKax.js";
import "@inertiajs/core";
import "./avatar-_KK8H2Pc.js";
import "@radix-ui/react-avatar";
import "./AppLayout-Drqdr6Z-.js";
import "@radix-ui/react-dialog";
import "@radix-ui/react-separator";
import "./skeleton-IN0PLOYc.js";
import "@radix-ui/react-slot";
import "./ToggleTheme-BSs-sHS2.js";
import "@radix-ui/react-dropdown-menu";
import "radix-ui";
import "cmdk";
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
import "@radix-ui/react-select";
import "vaul";
import "@radix-ui/react-popover";
import "./CurrencyInput-DtXsGVaN.js";
import "@dnd-kit/core";
import "@dnd-kit/sortable";
import "@dnd-kit/utilities";
import "./useDynamicRefs-DuDlSZ7v.js";
function GeneralLedger() {
  const { t } = useLaravelReactI18n();
  const { data } = useFormPage();
  return /* @__PURE__ */ jsx(
    FormPageContent,
    {
      value: "detail",
      title: t("core.finances.general_ledger.title"),
      children: /* @__PURE__ */ jsx("div", { className: "grid gap-x-3 gap-y-4", children: /* @__PURE__ */ jsx(
        FormTable,
        {
          columns: [
            {
              name: "account",
              titleTrans: "core.finances.general_ledger.columns.account",
              show: true,
              cell: ({ dataRow }) => {
                return /* @__PURE__ */ jsx(AccountLinkModel, { value: dataRow.account });
              }
            },
            {
              name: "debit",
              titleTrans: "core.finances.general_ledger.columns.debit"
            },
            {
              name: "credit",
              titleTrans: "core.finances.general_ledger.columns.credit"
            },
            {
              name: "created_at",
              titleTrans: "core.finances.general_ledger.columns.balance"
            }
          ],
          data
        }
      ) })
    }
  );
}
export {
  GeneralLedger as default
};
