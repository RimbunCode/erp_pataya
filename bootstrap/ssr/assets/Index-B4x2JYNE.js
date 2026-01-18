import { jsx, jsxs } from "react/jsx-runtime";
import { c as cn, a as getLocaleDate } from "./utils-ClCZGsDL.js";
import { useRef, useMemo } from "react";
import DataTable from "./DataTable-CVa4LVcS.js";
import { L as Link } from "./Link-p0Z4AKax.js";
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { router } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import "date-fns/locale";
import "lodash";
import "buffer";
import "clsx";
import "tailwind-merge";
import "lucide-react";
import "./button-Us2TB7GG.js";
import "radix-ui";
import "class-variance-authority";
import "./ToggleTheme-BSs-sHS2.js";
import "@radix-ui/react-dropdown-menu";
import "./MasterLayout-CRsmljQs.js";
import "@radix-ui/react-alert-dialog";
import "./use-mobile-BsFue-bT.js";
import "sonner";
import "zustand";
import "./tooltip-Df8khweJ.js";
import "@radix-ui/react-tooltip";
import "./select-XM4G_Lvw.js";
import "@radix-ui/react-select";
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
import "./avatar-_KK8H2Pc.js";
import "@radix-ui/react-avatar";
import "./Pagination-CiJtFFPu.js";
import "./Header-C9Xb62yg.js";
import "./Combobox-CnMmTQqc.js";
import "./drawer-D3vDykaS.js";
import "vaul";
import "./DatetimePicker-C3h7-5Qi.js";
import "react-day-picker";
import "@radix-ui/react-scroll-area";
import "react-detect-click-outside";
import "./checkbox-C_BEU5E4.js";
import "@radix-ui/react-checkbox";
import "./LoadingIcon-CRleOEtX.js";
import "axios";
import "pluralize";
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
import "@inertiajs/core";
import "@remixicon/react";
import "./Tags-D6pM3ZUY.js";
import "@marcbachmann/cel-js";
import "@dnd-kit/utilities";
import "@dnd-kit/sortable";
import "@dnd-kit/core";
function Index({ data, sort, show, lang }) {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const tableRef = useRef();
  const columns = useMemo(
    () => [
      {
        name: "name",
        titleTrans: "user.role.columns.name",
        searchType: "text",
        sortable: true,
        resizeable: true,
        cell: ({ dataRow }) => /* @__PURE__ */ jsx(
          Link,
          {
            className: "hover:underline",
            href: route("roles.show", dataRow.id),
            children: dataRow.name
          }
        )
      },
      {
        name: "is_disabled",
        titleTrans: "user.role.columns.is_disabled",
        width: "fit",
        sortable: true,
        searchType: "boolean",
        parse: {
          true: "Disabled",
          false: "Enabled"
        },
        cell: ({ dataRow, valueCell }) => {
          return /* @__PURE__ */ jsx(
            "button",
            {
              className: cn(
                dataRow.is_disabled ? "error" : "primary",
                "capitalize badge w-fit"
              ),
              type: "button",
              onClick: () => {
                tableRef.current.addFilter(
                  "is_disabled",
                  "eq",
                  dataRow.is_disabled
                );
              },
              children: valueCell
            }
          );
        }
      },
      {
        name: "created_at",
        titleTrans: "user.role.columns.created_at",
        searchType: "date",
        width: "fit",
        sortable: true,
        cell: ({ dataRow }) => {
          return /* @__PURE__ */ jsx("span", { children: format(new TZDate(dataRow.created_at, "UTC"), "PPPp", {
            locale: getLocaleDate(lang)
          }) });
        }
      }
    ],
    [lang]
  );
  return /* @__PURE__ */ jsx(
    DataTable,
    {
      ref: tableRef,
      title: t("user.role.title"),
      addButton: {
        title: t("user.role.add_role"),
        onClick: () => {
          router.visit(route("roles.create"));
        }
      },
      templateItem: ({ dataRow }) => /* @__PURE__ */ jsxs(
        Link,
        {
          as: "button",
          href: route("roles.show", dataRow.id),
          className: "flex items-center p-4 border-b gap-x-4 border-muted-foreground/25",
          children: [
            /* @__PURE__ */ jsx("p", { className: "text-base font-medium text-left", children: dataRow.name }),
            /* @__PURE__ */ jsx(
              "p",
              {
                className: cn(
                  dataRow.is_disabled ? "error" : "primary",
                  "text-left badge"
                ),
                children: dataRow.is_disabled ? "Disabled" : "Enabled"
              }
            )
          ]
        }
      ),
      data,
      defaultSort: sort,
      defaultShow: show,
      columns
    }
  );
}
export {
  Index as default
};
