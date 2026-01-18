import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { u as useFormPage, L as LinkModel, g as FormPageContent, a as FormInput, F as FormCheckbox } from "./checkbox-C_BEU5E4.js";
import { F as FormTable } from "./FormTable-8UNeAa3g.js";
import { I as Input } from "./input-wk3Ou7wI.js";
import PermissionLinkModel from "./PermissionLinkModel-Cy7R6yf4.js";
import { S as Select } from "./Select-DB9toH_t.js";
import { k as generateRandom } from "./utils-ClCZGsDL.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useMemo } from "react";
import "@radix-ui/react-checkbox";
import "lucide-react";
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
import "@radix-ui/react-separator";
import "./skeleton-IN0PLOYc.js";
import "@radix-ui/react-slot";
import "./ToggleTheme-BSs-sHS2.js";
import "@radix-ui/react-dropdown-menu";
import "./popover-CziqY8mR.js";
import "@radix-ui/react-popover";
import "./LoadingIcon-CRleOEtX.js";
import "axios";
import "lodash";
import "pluralize";
import "react-detect-click-outside";
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
import "date-fns/locale";
import "buffer";
import "clsx";
import "tailwind-merge";
import "@remixicon/react";
import "./Tags-D6pM3ZUY.js";
import "@marcbachmann/cel-js";
import "@dnd-kit/core";
import "@dnd-kit/sortable";
import "@dnd-kit/utilities";
import "./CurrencyInput-DtXsGVaN.js";
import "./useDynamicRefs-DuDlSZ7v.js";
function Form() {
  const { t } = useLaravelReactI18n();
  const { data, setData } = useFormPage();
  const stepColumns = useMemo(() => {
    return [
      {
        name: "approver_type",
        titleTrans: "core.approvalScheme.steps.columns.approver_type",
        required: true,
        cell({ data: data2, setData: setData2, attributes }) {
          return /* @__PURE__ */ jsx(
            Select,
            {
              value: data2,
              onValueChange: (val) => {
                console.log(val);
                setData2({
                  approver_type: val,
                  ...data2 != val ? { approver: null } : {}
                });
              },
              optionTrans: "core.approvalScheme.steps.columns.approver_type.options",
              options: ["role", "user"],
              ...attributes
            }
          );
        }
      },
      {
        name: "approver",
        titleTrans: "core.approvalScheme.steps.columns.approver",
        required: true,
        cell({ dataRow, data: data2, setData: setData2, attributes }) {
          return /* @__PURE__ */ jsx(
            LinkModel,
            {
              disabled: !(dataRow == null ? void 0 : dataRow.approver_type),
              model: (dataRow == null ? void 0 : dataRow.approver_type) == "role" ? "App\\Models\\User\\Role" : "App\\Models\\User\\User",
              value: data2,
              onValueChange: (val) => setData2("approver", val),
              disabledAddButton: true,
              ...attributes
            }
          );
        }
      }
    ];
  }, []);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(FormPageContent, { value: "detail", children: /* @__PURE__ */ jsxs("div", { className: "grid gap-x-3 gap-y-4", children: [
      !data.is_letter_head && /* @__PURE__ */ jsx(
        FormInput,
        {
          required: true,
          label: t("core.approvalScheme.columns.model"),
          children: /* @__PURE__ */ jsx(
            PermissionLinkModel,
            {
              required: true,
              placeholder: t("core.approvalScheme.columns.model.placeholder"),
              value: data.permission,
              onValueChange: (val) => setData((prev) => ({
                ...prev,
                permission: val,
                model: val == null ? void 0 : val.model,
                name: val ? `${val.name}_${generateRandom(5).toLowerCase()}` : ""
              })),
              filters: {
                is_submitable: true
              }
            }
          )
        }
      ),
      /* @__PURE__ */ jsx(
        FormInput,
        {
          required: true,
          label: t("core.approvalScheme.columns.name"),
          children: /* @__PURE__ */ jsx(
            Input,
            {
              value: (data == null ? void 0 : data.name) ?? "",
              onValueChange: (e) => setData("name", e)
            }
          )
        }
      ),
      /* @__PURE__ */ jsx(
        FormCheckbox,
        {
          checked: data.is_active,
          onCheckedChange: (val) => setData("is_active", val),
          label: t("core.approvalScheme.columns.is_active")
        }
      )
    ] }) }),
    /* @__PURE__ */ jsx(
      FormPageContent,
      {
        value: "detail",
        title: t("core.approvalScheme.columns.steps"),
        children: /* @__PURE__ */ jsx(
          FormTable,
          {
            name: "steps",
            columns: stepColumns,
            value: data.steps,
            onValueChange: (val) => setData("steps", val)
          }
        )
      }
    )
  ] });
}
export {
  Form as default
};
