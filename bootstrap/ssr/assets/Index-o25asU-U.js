import { jsx, jsxs } from "react/jsx-runtime";
import { A as Avatar, a as AvatarImage, b as AvatarFallback } from "./avatar-_KK8H2Pc.js";
import { D as Dialog, f as DialogContent, g as DialogHeader, h as DialogTitle, i as DialogDescription } from "./command-BSnyCa9u.js";
import { useState, useRef, useMemo } from "react";
import DataTable from "./DataTable-CVa4LVcS.js";
import { a as FormInput } from "./checkbox-C_BEU5E4.js";
import { I as Input } from "./input-wk3Ou7wI.js";
import { L as Link } from "./Link-p0Z4AKax.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
import "@radix-ui/react-avatar";
import "./utils-ClCZGsDL.js";
import "date-fns/locale";
import "lodash";
import "buffer";
import "clsx";
import "tailwind-merge";
import "@radix-ui/react-dialog";
import "lucide-react";
import "./use-mobile-BsFue-bT.js";
import "cmdk";
import "./button-Us2TB7GG.js";
import "radix-ui";
import "class-variance-authority";
import "./ToggleTheme-BSs-sHS2.js";
import "@radix-ui/react-dropdown-menu";
import "./MasterLayout-CRsmljQs.js";
import "@radix-ui/react-alert-dialog";
import "@inertiajs/react";
import "sonner";
import "zustand";
import "./tooltip-Df8khweJ.js";
import "@radix-ui/react-tooltip";
import "./select-XM4G_Lvw.js";
import "@radix-ui/react-select";
import "./AppLayout-Drqdr6Z-.js";
import "@radix-ui/react-separator";
import "./skeleton-IN0PLOYc.js";
import "@radix-ui/react-slot";
import "./popover-CziqY8mR.js";
import "@radix-ui/react-popover";
import "./Pagination-CiJtFFPu.js";
import "./Header-C9Xb62yg.js";
import "./Combobox-CnMmTQqc.js";
import "./drawer-D3vDykaS.js";
import "vaul";
import "./DatetimePicker-C3h7-5Qi.js";
import "react-day-picker";
import "@radix-ui/react-scroll-area";
import "date-fns";
import "react-detect-click-outside";
import "@dnd-kit/utilities";
import "@dnd-kit/sortable";
import "./label-DiFvdPYz.js";
import "@radix-ui/react-label";
import "qs";
import "@date-fns/tz";
import "@dnd-kit/core";
import "@radix-ui/react-checkbox";
import "./LoadingIcon-CRleOEtX.js";
import "axios";
import "pluralize";
import "./tabs-DhZjhdeH.js";
import "@radix-ui/react-tabs";
import "./InputError-2JjWc6nJ.js";
import "./Select-DB9toH_t.js";
import "@radix-ui/react-accordion";
import "@radix-ui/react-progress";
import "@headlessui/react";
import "./Comments-Bvo3255G.js";
import "quill-mention/autoregister";
import "quill";
import "@inertiajs/core";
import "@remixicon/react";
import "./Tags-D6pM3ZUY.js";
import "@marcbachmann/cel-js";
function Index() {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const [openNewUser, setOpenNewUser] = useState(false);
  const tableRef = useRef();
  const columns = useMemo(
    () => [
      {
        name: "name",
        titleTrans: "user.user.columns.name",
        searchType: "text",
        sortable: true,
        resizeable: true,
        cell: ({ dataRow }) => /* @__PURE__ */ jsx(
          Link,
          {
            className: "hover:underline",
            href: route("users.show", dataRow.id),
            children: dataRow.name
          }
        )
      },
      {
        name: "email",
        titleTrans: "user.user.columns.email",
        searchType: "text",
        sortable: true,
        resizeable: true
      },
      {
        name: "status",
        titleTrans: "user.user.columns.status",
        width: "fit",
        searchType: ["invited", "active", "inactive"],
        parse: {
          invited: "Invitedd",
          active: "Actived",
          inactive: "Inactived"
        },
        cell: ({ dataRow }) => /* @__PURE__ */ jsx(
          "button",
          {
            className: "capitalize badge success w-fit",
            type: "button",
            onClick: () => {
              tableRef.current.addFilter("status", "eq", dataRow.status);
            },
            children: dataRow.status.replace(/(\-|\_)/g, " ")
          }
        )
      }
    ],
    []
  );
  return /* @__PURE__ */ jsxs(Dialog, { open: openNewUser, onOpenChange: setOpenNewUser, children: [
    /* @__PURE__ */ jsx(
      DataTable,
      {
        ref: tableRef,
        title: t("user.user.title"),
        templateItem: ({ dataRow: user }) => {
          const alias = user.name.split(" ").slice(0, 2).map((n) => n.charAt(0)).join("");
          return /* @__PURE__ */ jsxs(
            Link,
            {
              as: "button",
              href: route("users.show", user.id),
              className: "flex justify-start gap-1 p-4 border-b gap-x-4 border-muted-foreground/25",
              children: [
                /* @__PURE__ */ jsxs(Avatar, { className: "rounded-lg size-12", children: [
                  user.image && /* @__PURE__ */ jsx(
                    AvatarImage,
                    {
                      src: route("files.preview", user.image) + `?v=${new Date(user.updated_at).getTime()}`,
                      alt: user.name
                    }
                  ),
                  /* @__PURE__ */ jsx(AvatarFallback, { className: "text-xl font-semibold rounded-full", children: alias })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
                  /* @__PURE__ */ jsx("p", { className: "font-semibold text-left", children: user.name }),
                  /* @__PURE__ */ jsx("p", { className: "text-sm text-left", children: user.email })
                ] })
              ]
            }
          );
        },
        addButton: {
          title: t("user.user.addButton"),
          onClick: () => {
            setOpenNewUser(true);
          }
        },
        columns
      }
    ),
    /* @__PURE__ */ jsxs(DialogContent, { className: "max-w-lg", children: [
      /* @__PURE__ */ jsxs(DialogHeader, { children: [
        /* @__PURE__ */ jsx(DialogTitle, { children: "New User" }),
        /* @__PURE__ */ jsx(DialogDescription, { className: "sr-only", children: "Invite new user using email" })
      ] }),
      /* @__PURE__ */ jsx(FormInput, { label: "Fullname", children: /* @__PURE__ */ jsx(Input, { required: true, name: "fullname", type: "text", placeholder: "John Doe" }) }),
      /* @__PURE__ */ jsx(FormInput, { label: "Email", children: /* @__PURE__ */ jsx(Input, { required: true, name: "email", type: "email", placeholder: "John Doe" }) }),
      /* @__PURE__ */ jsx(FormInput, { label: "Role", children: /* @__PURE__ */ jsx(Input, { required: true, placeholder: "John Doe" }) })
    ] })
  ] });
}
export {
  Index as default
};
