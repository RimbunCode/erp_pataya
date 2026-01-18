import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { a as AvatarImage, A as Avatar, b as AvatarFallback } from "./avatar-_KK8H2Pc.js";
import { c as CommandItem, D as Dialog, e as DialogTrigger, f as DialogContent, g as DialogHeader } from "./command-BSnyCa9u.js";
import { DialogTitle, DialogDescription } from "@radix-ui/react-dialog";
import { h as FormPage, g as FormPageContent, a as FormInput, k as FormPageContentTitle, F as FormCheckbox, U as UploadDialog } from "./checkbox-C_BEU5E4.js";
import { useState, useCallback, useMemo } from "react";
import { UploadIcon, Trash2, SaveIcon } from "lucide-react";
import { S as Select, a as SelectTrigger, b as SelectValue, c as SelectContent, d as SelectItem } from "./select-XM4G_Lvw.js";
import { T as Tooltip, a as TooltipTrigger, b as TooltipContent } from "./tooltip-Df8khweJ.js";
import { B as Button } from "./button-Us2TB7GG.js";
import { C as Combobox } from "./Combobox-CnMmTQqc.js";
import { D as DatetimePicker } from "./DatetimePicker-C3h7-5Qi.js";
import { I as Input } from "./input-wk3Ou7wI.js";
import axios from "axios";
import { c as useDraftForm } from "./Link-p0Z4AKax.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
import "@radix-ui/react-avatar";
import "./utils-ClCZGsDL.js";
import "date-fns/locale";
import "lodash";
import "buffer";
import "clsx";
import "tailwind-merge";
import "./use-mobile-BsFue-bT.js";
import "cmdk";
import "@radix-ui/react-checkbox";
import "class-variance-authority";
import "./MasterLayout-CRsmljQs.js";
import "@radix-ui/react-alert-dialog";
import "@inertiajs/react";
import "sonner";
import "zustand";
import "./AppLayout-Drqdr6Z-.js";
import "@radix-ui/react-separator";
import "./skeleton-IN0PLOYc.js";
import "@radix-ui/react-slot";
import "./ToggleTheme-BSs-sHS2.js";
import "@radix-ui/react-dropdown-menu";
import "radix-ui";
import "./popover-CziqY8mR.js";
import "@radix-ui/react-popover";
import "./LoadingIcon-CRleOEtX.js";
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
import "@inertiajs/core";
import "@remixicon/react";
import "./Tags-D6pM3ZUY.js";
import "@marcbachmann/cel-js";
import "@radix-ui/react-select";
import "@radix-ui/react-tooltip";
import "./drawer-D3vDykaS.js";
import "vaul";
import "react-day-picker";
import "@radix-ui/react-scroll-area";
function Show({ user, roles, branches }) {
  const { t } = useLaravelReactI18n();
  const { data, setData, put, processing, errors, isDirty } = useDraftForm(
    "user",
    user
  );
  const route = window.route;
  const [openAttachment, setOpenAttachment] = useState(false);
  const [openDetailRole, setOpenDetailRole] = useState(false);
  const [detailsRole, setDetailsRole] = useState();
  const alias = user.name.split(" ").slice(0, 2).map((n) => n.charAt(0)).join("");
  const onSubmit = (e) => {
    e.preventDefault();
    put(route("users.update", user.id));
  };
  const getDetailsRole = useCallback((id) => {
    axios.get(route("roles.show", id)).then(({ data: data2 }) => {
      setDetailsRole(data2);
      setOpenDetailRole(true);
    }).catch((err) => {
      console.log(err);
    });
  }, []);
  const avatar = useMemo(() => {
    if (!user.image) return null;
    return /* @__PURE__ */ jsx(
      AvatarImage,
      {
        src: route("files.preview", user.image) + `?v=${new Date(user.updated_at).getTime()}`,
        alt: user.name,
        className: " transition-[filter] group-hover:blur-sm"
      }
    );
  }, [user.image]);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs(
      FormPage,
      {
        errors,
        disabled: processing,
        title: user.name,
        badge: isDirty && /* @__PURE__ */ jsx("span", { className: "text-sm badge warning", children: t("core.form.not_saved") }),
        controls: /* @__PURE__ */ jsxs(
          Button,
          {
            role: "save",
            className: "p-2! size-fit h-8",
            onClick: onSubmit,
            disabled: processing,
            children: [
              /* @__PURE__ */ jsx(SaveIcon, {}),
              t("core.form.save")
            ]
          }
        ),
        sidebarContent: (defaultComp) => /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsxs(Dialog, { open: openAttachment, onOpenChange: setOpenAttachment, children: [
            /* @__PURE__ */ jsxs(Avatar, { className: "relative w-full h-auto border rounded-xl aspect-square max-w-64 group", children: [
              avatar,
              /* @__PURE__ */ jsx(AvatarFallback, { className: "rounded-lg", children: /* @__PURE__ */ jsx("p", { className: "w-full font-semibold text-center text-muted-foreground text-9xl transition-[filter]", children: alias }) }),
              /* @__PURE__ */ jsxs("div", { className: "absolute flex items-center justify-center w-full h-full transition-opacity border opacity-0 cursor-pointer group-hover:opacity-100 bg-background/25 rounded-xl gap-x-4", children: [
                /* @__PURE__ */ jsxs(Tooltip, { children: [
                  /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx(DialogTrigger, { asChild: true, children: /* @__PURE__ */ jsx(Button, { variant: "default", size: "icon", children: /* @__PURE__ */ jsx(UploadIcon, { className: "size-5!" }) }) }) }),
                  /* @__PURE__ */ jsx(TooltipContent, { align: "center", children: "Upload" })
                ] }),
                user.image && /* @__PURE__ */ jsxs(Tooltip, { children: [
                  /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx(Button, { variant: "destructive", size: "icon", children: /* @__PURE__ */ jsx(Trash2, { className: "size-5!" }) }) }),
                  /* @__PURE__ */ jsx(TooltipContent, { align: "center", children: "Remove" })
                ] })
              ] })
            ] }),
            /* @__PURE__ */ jsx(
              UploadDialog,
              {
                open: openAttachment,
                imageOnly: true,
                options: {
                  route: route(route().current(), route().params) + "/image",
                  reset: ["user", "auth"]
                },
                onClose: () => {
                  setOpenAttachment(false);
                }
              }
            )
          ] }),
          defaultComp
        ] }),
        children: [
          /* @__PURE__ */ jsx(FormPageContent, { title: t("user.user.basic_info"), value: "basic_info", children: /* @__PURE__ */ jsxs("div", { className: "grid pt-2 gap-x-8 gap-y-4 md:grid-cols-3", children: [
            /* @__PURE__ */ jsx(FormInput, { label: t("user.user.columns.email"), required: true, children: /* @__PURE__ */ jsx(
              Input,
              {
                type: "email",
                value: data.email,
                onChange: (e) => setData("email", e.target.value)
              }
            ) }),
            /* @__PURE__ */ jsx(FormInput, { label: t("user.user.columns.username"), required: true, children: /* @__PURE__ */ jsx(
              Input,
              {
                value: data.username,
                onChange: (e) => setData("username", e.target.value)
              }
            ) }),
            /* @__PURE__ */ jsx(FormInput, { label: t("user.user.columns.name"), required: true, children: /* @__PURE__ */ jsx(
              Input,
              {
                value: data.name,
                onChange: (e) => setData("name", e.target.value)
              }
            ) }),
            /* @__PURE__ */ jsx(FormInput, { label: t("user.user.columns.gender"), children: /* @__PURE__ */ jsxs(
              Select,
              {
                value: data.gender,
                onValueChange: (val) => setData("gender", val),
                children: [
                  /* @__PURE__ */ jsx(SelectTrigger, { className: "", children: /* @__PURE__ */ jsx(SelectValue, { placeholder: "Gender" }) }),
                  /* @__PURE__ */ jsxs(SelectContent, { children: [
                    /* @__PURE__ */ jsx(SelectItem, { value: "male", children: "Male" }),
                    /* @__PURE__ */ jsx(SelectItem, { value: "female", children: "Female" })
                  ] })
                ]
              }
            ) }),
            /* @__PURE__ */ jsx(FormInput, { label: t("user.user.columns.phone"), children: /* @__PURE__ */ jsx(
              Input,
              {
                type: "text",
                value: data.phone,
                onChange: (e) => setData("phone", e.target.value)
              }
            ) }),
            /* @__PURE__ */ jsx(FormInput, { label: t("user.user.columns.birthdate"), children: /* @__PURE__ */ jsx(
              DatetimePicker,
              {
                type: "date",
                value: data.birthdate,
                onValueChange: (val) => setData("birthdate", val)
              }
            ) })
          ] }) }),
          /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsxs(
              FormPageContent,
              {
                title: t("user.user.roles_and_permissions"),
                value: "roles_and_permissions",
                children: [
                  /* @__PURE__ */ jsx(FormPageContentTitle, { children: t("user.user.roles") }),
                  /* @__PURE__ */ jsx("div", { className: "columns-[15rem] gap-x-2 space-y-4 mt-2", children: roles && roles.map((role) => /* @__PURE__ */ jsx(
                    FormCheckbox,
                    {
                      disabled: role.is_disabled,
                      checked: data.roles.includes(role.id),
                      onCheckedChange: (val) => {
                        if (val) {
                          setData("roles", [...data.roles, role.id]);
                        } else {
                          setData(
                            "roles",
                            data.roles.filter((x) => x !== role.id)
                          );
                        }
                      },
                      classNameLabel: "text-sm font-medium leading-none cursor-pointer hover:underline peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
                      children: /* @__PURE__ */ jsx("span", { onClick: () => getDetailsRole(role.id), children: role.name })
                    },
                    role.id
                  )) })
                ]
              }
            ),
            /* @__PURE__ */ jsxs(
              FormPageContent,
              {
                title: t("user.user.roles_and_permissions"),
                value: "roles_and_permissions",
                children: [
                  /* @__PURE__ */ jsx(FormPageContentTitle, { children: t("user.user.branches") }),
                  /* @__PURE__ */ jsx("div", { className: "columns-[15rem] gap-x-2 space-y-4 mt-2", children: branches && branches.map((branch) => {
                    var _a;
                    return /* @__PURE__ */ jsx(
                      FormCheckbox,
                      {
                        disabled: branch.is_disabled,
                        checked: (_a = data.branches) == null ? void 0 : _a.includes(branch.id),
                        onCheckedChange: (val) => {
                          var _a2;
                          if (val) {
                            setData("branches", [...data.branches, branch.id]);
                          } else {
                            setData(
                              "branches",
                              (_a2 = data.branches) == null ? void 0 : _a2.filter((x) => x !== branch.id)
                            );
                            if (branch.id == data.default_branch_id) {
                              setData("default_branch_id", null);
                            }
                          }
                        },
                        classNameLabel: "text-sm font-medium leading-none cursor-pointer hover:underline peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
                        label: branch.name
                      },
                      branch.id
                    );
                  }) }),
                  /* @__PURE__ */ jsx(
                    FormInput,
                    {
                      className: "max-w-sm mt-4",
                      label: t("user.user.default_branch"),
                      required: true,
                      children: /* @__PURE__ */ jsx(
                        Combobox,
                        {
                          options: branches == null ? void 0 : branches.filter(
                            (branch) => {
                              var _a;
                              return (_a = data.branches) == null ? void 0 : _a.includes(branch.id);
                            }
                          ),
                          value: data.default_branch_id,
                          placeholder: t("user.user.default_branch.placeholder"),
                          templateTrigger: (branch_id) => {
                            const branch = branches == null ? void 0 : branches.find((c) => c.id === branch_id);
                            return /* @__PURE__ */ jsx("span", { children: branch == null ? void 0 : branch.name });
                          },
                          templateItem: (branch) => {
                            return /* @__PURE__ */ jsx(
                              CommandItem,
                              {
                                value: `${branch.name} ${branch.id}`,
                                keywords: [branch.id, branch.name],
                                onSelect: () => {
                                  setData("default_branch_id", branch.id);
                                },
                                className: "block px-4 ",
                                children: branch.name
                              },
                              branch.id
                            );
                          }
                        }
                      )
                    }
                  )
                ]
              }
            )
          ] })
        ]
      }
    ),
    /* @__PURE__ */ jsx(Dialog, { open: openDetailRole, onOpenChange: setOpenDetailRole, children: /* @__PURE__ */ jsxs(DialogContent, { className: "max-w-(--breakpoint-lg) border-muted-foreground/25", children: [
      /* @__PURE__ */ jsxs(DialogHeader, { className: "pb-2 border-b border-muted-foreground/25", children: [
        /* @__PURE__ */ jsx(DialogTitle, { className: "font-bold", children: detailsRole && detailsRole.name }),
        /* @__PURE__ */ jsx(DialogDescription, { className: "sr-only" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "grid [&>div]:px-3 gap-x-1 grid-cols-[minmax(auto,1fr)_max-content_auto_repeat(12,max-content)] text-sm [&>div>*]:px-1h max-w-full w-full overflow-x-auto [&>div>*]:h-full [&>div>*]:items-center [&>div>*]:flex [&>div>*]:justify-center [&>div>*]:py-2 [&>div>*:not(:last-child)]:border-0", children: [
        /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-subgrid col-span-full items-center rounded-md bg-muted [&>div]:font-bold [&>div]:text-xs lg:[&>div]:text-sm", children: [
          /* @__PURE__ */ jsx("div", { className: "pr-2! pl-2! justify-start! text-left", children: "Model" }),
          /* @__PURE__ */ jsx("div", { className: "text-center", children: "Level" }),
          /* @__PURE__ */ jsx("div", { className: "text-center", children: "If Owner" }),
          [
            "select",
            "read",
            "write",
            "create",
            "delete",
            "submit",
            "cancel",
            "amend",
            "print",
            "import",
            "export",
            "share"
          ].map((x) => /* @__PURE__ */ jsx("div", { className: "text-center capitalize", children: x }, x))
        ] }),
        (detailsRole == null ? void 0 : detailsRole.rules) && detailsRole.rules.map((rule) => /* @__PURE__ */ jsxs(
          "div",
          {
            className: "grid border-b col-span-full items-center grid-cols-subgrid border-muted-foreground/25 [&>div]:text-xs lg:[&>div]:text-sm",
            children: [
              /* @__PURE__ */ jsx("div", { className: "pr-2! justify-start! text-left", children: rule.name }),
              /* @__PURE__ */ jsx("div", { className: "text-center", children: rule.level }),
              /* @__PURE__ */ jsx("div", { className: "text-center", children: rule.if_owner ? "✓" : "-" }),
              [
                "select",
                "read",
                "write",
                "create",
                "delete",
                "submit",
                "cancel",
                "amend",
                "print",
                "import",
                "export",
                "share"
              ].map((x) => /* @__PURE__ */ jsx("div", { className: "text-center", children: rule.permissions[x] ? "✓" : "-" }, x))
            ]
          },
          rule.id
        ))
      ] })
    ] }) })
  ] });
}
export {
  Show as default
};
