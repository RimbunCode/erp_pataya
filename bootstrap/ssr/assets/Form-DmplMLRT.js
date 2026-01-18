import { jsxs, Fragment, jsx } from "react/jsx-runtime";
import { u as useFormPage, g as FormPageContent, a as FormInput, T as Textarea, F as FormCheckbox, C as Checkbox } from "./checkbox-C_BEU5E4.js";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useState, useCallback } from "react";
import { B as Button } from "./button-Us2TB7GG.js";
import { I as Input } from "./input-wk3Ou7wI.js";
import PermissionLinkModel from "./PermissionLinkModel-Cy7R6yf4.js";
import { k as generateRandom } from "./utils-ClCZGsDL.js";
import { toast } from "sonner";
import { useLaravelReactI18n } from "laravel-react-i18n";
import "@radix-ui/react-checkbox";
import "class-variance-authority";
import "./MasterLayout-CRsmljQs.js";
import "@radix-ui/react-alert-dialog";
import "./use-mobile-BsFue-bT.js";
import "@inertiajs/react";
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
import "radix-ui";
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
import "date-fns/locale";
import "buffer";
import "clsx";
import "tailwind-merge";
import "@remixicon/react";
import "./Tags-D6pM3ZUY.js";
import "@marcbachmann/cel-js";
function Form() {
  var _a;
  const { data, setData } = useFormPage();
  const { t } = useLaravelReactI18n();
  const [newRule, setNewRule] = useState({ level: 0, only_creator: false });
  const onAddPermission = () => {
    var _a2, _b, _c;
    if (!newRule.model) return;
    if (((_a2 = data.rules) == null ? void 0 : _a2.findIndex(
      (r) => r.permission_id == newRule.model.id && r.only_creator === newRule.only_creator && r.level === newRule.level
    )) >= 0) {
      toast("Rule already exists", {
        duration: 3e3
      });
      return;
    }
    const permissionKeys = newRule.level > 0 ? ["read", "write"] : newRule.model.permissions;
    setData("rules", [
      {
        permission_id: newRule.model.id,
        name: newRule.model.name,
        level: Number(((_b = newRule.model) == null ? void 0 : _b.is_submitable) ? newRule.level : 0),
        only_creator: newRule.level > 0 ? false : newRule.only_creator,
        is_submitable: newRule.level == 0 && ((_c = newRule.model) == null ? void 0 : _c.is_submitable),
        id: generateRandom(8),
        isNew: true,
        permissions: Object.fromEntries(permissionKeys.map((k) => [k, false])),
        permissionKeys
      },
      ...data.rules ?? []
    ]);
    setNewRule({ level: 0, only_creator: false });
  };
  const onOnlyCreatorChange = useCallback(
    (val, rule) => {
      var _a2;
      if (((_a2 = data.rules) == null ? void 0 : _a2.findIndex(
        (r) => r.permission_id == rule.permission_id && r.only_creator === val && r.level === rule.level
      )) >= 0) {
        toast(t("user.role.alert_already_exists"), {
          duration: 3e3
        });
        return;
      }
      setData(
        "rules",
        data == null ? void 0 : data.rules.map(
          (r) => r.id === rule.id ? { ...r, only_creator: val } : r
        )
      );
    },
    [data.rules, t]
  );
  const onPermissionChange = useCallback((rule, key, val) => {
    setData((prev) => {
      const rules = prev.rules.map((r) => {
        if (r.id != rule.id) return r;
        let permissions = { ...r.permissions, [key]: val };
        if (key === "read" && !val) {
          permissions = {
            ...permissions,
            write: false,
            ...rule.level === 0 && {
              create: false,
              delete: false,
              amend: false,
              submit: false,
              cancel: false,
              import: false,
              export: false,
              share: false,
              print: false
            }
          };
        }
        if (key !== "read" && key !== "select" && val === true) {
          permissions.read = true;
          if (key === "import") {
            permissions.create = true;
          }
        }
        permissions = Object.fromEntries(
          Object.entries(permissions).filter(
            ([k]) => {
              var _a2;
              return (_a2 = rule.permissionKeys) == null ? void 0 : _a2.includes(k);
            }
          )
        );
        return { ...r, permissions };
      });
      return {
        ...prev,
        rules
      };
    });
  }, []);
  const toggleAllPermissions = useCallback((rule, val) => {
    setData(
      "rules",
      data == null ? void 0 : data.rules.map(
        (r) => r.id === rule.id ? {
          ...r,
          permissions: Object.fromEntries(
            Object.entries(r.permissions).map(([k]) => [k, val])
          )
        } : r
      )
    );
  });
  const getCheckState = useCallback((permissions, keys) => {
    let hasTrue = false, hasFalse = false;
    for (const k of keys) {
      permissions[k] ? hasTrue = true : hasFalse = true;
      if (hasTrue && hasFalse) return "indeterminate";
    }
    return hasTrue ? true : false;
  }, []);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(FormPageContent, { title: "General", value: "general", children: /* @__PURE__ */ jsxs("div", { className: "grid gap-y-4 gap-x-4", children: [
      /* @__PURE__ */ jsx(FormInput, { label: "Name", required: true, name: "name", children: /* @__PURE__ */ jsx(
        Input,
        {
          value: data == null ? void 0 : data.name,
          onChange: (e) => setData("name", e.target.value)
        }
      ) }),
      /* @__PURE__ */ jsx(FormInput, { label: "Description", name: "description", children: /* @__PURE__ */ jsx(
        Textarea,
        {
          value: (data == null ? void 0 : data.description) ?? "",
          onChange: (e) => setData("description", e.target.value)
        }
      ) }),
      /* @__PURE__ */ jsx(
        FormCheckbox,
        {
          checked: data == null ? void 0 : data.is_disabled,
          onCheckedChange: (val) => setData("is_disabled", val),
          label: "Disabled"
        }
      )
    ] }) }),
    /* @__PURE__ */ jsx(FormPageContent, { title: "Permission Manager", value: "permission_manager", children: /* @__PURE__ */ jsxs("div", { className: "grid gap-x-4 grid-cols-[minmax(auto,384px)_max-content_minmax(0,1fr)_64px] text-sm  [&>div>*]:px-4 max-w-full overflow-hidden", children: [
      /* @__PURE__ */ jsxs("div", { className: "border-2 shadow-md rounded-xl p-4 grid col-span-4 grid-cols-subgrid [&_label]:text-base! mb-4 *:px-0! [&_[role=forminput]]:gap-y-0.5! border-b pb-4  border-muted-foreground/25", children: [
        /* @__PURE__ */ jsx("div", { className: "col-span-4 pb-1 mb-2 border-b border-muted-foreground/25", children: /* @__PURE__ */ jsx("h1", { className: "text-base font-bold", children: t("user.role.new_rule") }) }),
        /* @__PURE__ */ jsx(
          FormInput,
          {
            label: t("user.role.columns.model"),
            required: true,
            className: "ml-1",
            children: /* @__PURE__ */ jsx(
              PermissionLinkModel,
              {
                required: false,
                placeholder: t("user.role.columns.model.placeholder"),
                value: newRule.model,
                onValueChange: (val) => setNewRule((prev) => ({
                  ...prev,
                  model: val,
                  level: (val == null ? void 0 : val.is_submitable) ? prev.level : 0
                }))
              }
            )
          }
        ),
        /* @__PURE__ */ jsx(FormInput, { label: t("user.role.columns.level"), children: /* @__PURE__ */ jsx(
          Input,
          {
            type: "number",
            disabled: !(((_a = newRule.model) == null ? void 0 : _a.is_submitable) ?? false),
            value: newRule.level,
            onChange: (e) => {
              setNewRule((prev) => ({ ...prev, level: e.target.value }));
            },
            min: 0,
            max: 9,
            className: "w-16 text-center"
          }
        ) }),
        /* @__PURE__ */ jsxs("div", { className: "flex justify-between col-span-2 gap-x-4", children: [
          /* @__PURE__ */ jsx(
            FormInput,
            {
              label: t("user.role.columns.only_creator"),
              className: "w-fit",
              children: (id) => {
                var _a2;
                return /* @__PURE__ */ jsx("div", { className: "flex items-center justify-center flex-1 w-full", children: /* @__PURE__ */ jsx(
                  Checkbox,
                  {
                    disabled: newRule.level > 0 || !(((_a2 = newRule.model) == null ? void 0 : _a2.is_submitable) ?? false),
                    id,
                    checked: newRule.level > 0 ? false : newRule.only_creator,
                    onCheckedChange: (val) => setNewRule((prev) => ({ ...prev, only_creator: val }))
                  }
                ) });
              }
            }
          ),
          /* @__PURE__ */ jsx(FormInput, { label: "", className: "justify-end w-fit", children: /* @__PURE__ */ jsxs(
            Button,
            {
              type: "button",
              variant: "default",
              className: "h-8 w-fit",
              onClick: onAddPermission,
              children: [
                /* @__PURE__ */ jsx(PlusIcon, { className: "size-5" }),
                t("user.role.add_rule")
              ]
            }
          ) })
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "col-span-4 pb-1 mt-4 mb-2 border-b border-muted-foreground/25", children: /* @__PURE__ */ jsx("h1", { className: "-ml-3 text-xl font-bold", children: t("user.role.rules") }) }),
      /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-subgrid col-span-4 rounded-md py-2 bg-muted [&>div]:font-bold [&>div]:text-sm", children: [
        /* @__PURE__ */ jsx("div", { children: t("user.role.columns.model") }),
        /* @__PURE__ */ jsx("div", { children: t("user.role.columns.level") }),
        /* @__PURE__ */ jsx("div", { children: t("user.role.columns.permissions") })
      ] }),
      (data == null ? void 0 : data.rules) && (data == null ? void 0 : data.rules.length) > 0 ? data == null ? void 0 : data.rules.map((rule) => {
        const allChecked = getCheckState(
          (rule == null ? void 0 : rule.permissions) ?? [],
          (rule == null ? void 0 : rule.permissionKeys) ?? []
        );
        return /* @__PURE__ */ jsxs(
          "div",
          {
            className: "grid col-span-4 py-4 border-b grid-cols-subgrid border-muted-foreground/25",
            children: [
              /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-y-4", children: [
                /* @__PURE__ */ jsx("span", { className: "font-medium", children: rule.name }),
                rule.level <= 0 && rule.is_submitable && /* @__PURE__ */ jsx(
                  FormCheckbox,
                  {
                    checked: rule.only_creator,
                    onCheckedChange: (val) => onOnlyCreatorChange(val, rule),
                    label: t("user.role.columns.only_creator")
                  }
                )
              ] }),
              /* @__PURE__ */ jsx("div", { className: "font-medium text-center", children: rule.level }),
              /* @__PURE__ */ jsxs("div", { className: "columns-[76px] space-y-3 self-center items-center", children: [
                /* @__PURE__ */ jsx(
                  FormCheckbox,
                  {
                    checked: allChecked,
                    onCheckedChange: (val) => toggleAllPermissions(rule, val),
                    label: t(`user.role.permissions.all`),
                    classNameLabel: "capitalize"
                  }
                ),
                rule.permissionKeys.map((key) => {
                  const value = rule.permissions[key] ?? false;
                  return /* @__PURE__ */ jsx(
                    FormCheckbox,
                    {
                      checked: value,
                      onCheckedChange: (val) => onPermissionChange(rule, key, val),
                      label: t(`user.role.permissions.${key}`),
                      classNameLabel: "capitalize"
                    },
                    key
                  );
                })
              ] }),
              /* @__PURE__ */ jsx("div", { className: "flex justify-center", children: /* @__PURE__ */ jsx(
                Button,
                {
                  variant: "destructive",
                  size: "icon",
                  className: "size-8",
                  onClick: () => {
                    setData(
                      "rules",
                      data == null ? void 0 : data.rules.filter((r) => r.id !== rule.id)
                    );
                  },
                  children: /* @__PURE__ */ jsx(Trash2Icon, { className: "size-5" })
                }
              ) })
            ]
          },
          rule.id
        );
      }) : (
        // No rules
        /* @__PURE__ */ jsx("div", { className: "grid col-span-4 py-4 border-b grid-cols-subgrid border-muted-foreground/25", children: /* @__PURE__ */ jsx("p", { className: "flex flex-col col-span-4 text-center gap-y-4", children: /* @__PURE__ */ jsx("span", { className: "font-medium", children: "No rules found" }) }) })
      )
    ] }) })
  ] });
}
export {
  Form as default
};
