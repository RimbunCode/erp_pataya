import { jsx, jsxs } from "react/jsx-runtime";
import { u as useFormPage, g as FormPageContent, a as FormInput } from "./checkbox-C_BEU5E4.js";
import { memo } from "react";
import BranchLinkModel from "./BranchLinkModel-C7QCrxBS.js";
import { I as Input } from "./input-wk3Ou7wI.js";
import UserLinkModel from "./UserLinkModel-Dt8-ovm1.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";
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
import "./Form-B00usptC.js";
import "./CountryLinkModel-sHdBSxco.js";
const Form = memo(function Form2() {
  var _a;
  const { data, setData } = useFormPage();
  const { t } = useLaravelReactI18n();
  const { branchSettings } = usePage().props;
  return /* @__PURE__ */ jsx(FormPageContent, { title: "Detail", value: "detail", children: /* @__PURE__ */ jsxs("div", { className: "grid pt-2 gap-x-8 gap-y-4", children: [
    ((_a = branchSettings == null ? void 0 : branchSettings.currentBranch) == null ? void 0 : _a.is_main_branch) && /* @__PURE__ */ jsx(FormInput, { label: "Branch", required: true, children: /* @__PURE__ */ jsx(
      BranchLinkModel,
      {
        placeholder: t("inventory.warehouse.columns.branch.placeholder"),
        value: data.branch,
        onValueChange: (val) => setData("branch", val),
        filters: {
          branchable_type: null,
          branchable_id: null
        }
      }
    ) }),
    /* @__PURE__ */ jsx(FormInput, { label: "Code", required: true, children: /* @__PURE__ */ jsx(
      Input,
      {
        value: data.code,
        onChange: (e) => setData("code", e.target.value)
      }
    ) }),
    /* @__PURE__ */ jsx(FormInput, { label: "Name", required: true, children: /* @__PURE__ */ jsx(
      Input,
      {
        value: data.name,
        onChange: (e) => setData("name", e.target.value)
      }
    ) }),
    /* @__PURE__ */ jsx(FormInput, { label: "PIC", children: /* @__PURE__ */ jsx(
      UserLinkModel,
      {
        placeholder: t("inventory.warehouse.columns.pic.placeholder"),
        value: data.pic,
        onValueChange: (val) => setData("pic", val)
      }
    ) })
  ] }) });
});
export {
  Form as default
};
