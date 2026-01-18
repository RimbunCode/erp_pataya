import { jsx, jsxs } from "react/jsx-runtime";
import DataTable2 from "./DataTable2-sz-ATj9o.js";
import Form from "./Form-B00usptC.js";
import { L as Link } from "./Link-p0Z4AKax.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
import "lucide-react";
import "./button-Us2TB7GG.js";
import "react";
import "radix-ui";
import "./utils-ClCZGsDL.js";
import "date-fns/locale";
import "lodash";
import "buffer";
import "clsx";
import "tailwind-merge";
import "class-variance-authority";
import "./ToggleTheme-BSs-sHS2.js";
import "@radix-ui/react-dropdown-menu";
import "./MasterLayout-CRsmljQs.js";
import "@radix-ui/react-alert-dialog";
import "./use-mobile-BsFue-bT.js";
import "@inertiajs/react";
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
import "date-fns";
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
import "@date-fns/tz";
import "@inertiajs/core";
import "@remixicon/react";
import "./Tags-D6pM3ZUY.js";
import "@marcbachmann/cel-js";
import "@dnd-kit/utilities";
import "@dnd-kit/sortable";
import "./Table2-DWJgyKWG.js";
import "@dnd-kit/core";
import "./useDynamicRefs-DuDlSZ7v.js";
import "./CountryLinkModel-sHdBSxco.js";
function Index() {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  return /* @__PURE__ */ jsx(
    DataTable2,
    {
      templateItem: ({ dataRow }) => {
        var _a;
        return /* @__PURE__ */ jsxs(
          Link,
          {
            as: "button",
            href: route("branches.show", dataRow.id),
            className: "items-center block p-4 border-b border-muted-foreground/25",
            children: [
              /* @__PURE__ */ jsxs("p", { className: "flex items-center font-semibold text-left", children: [
                dataRow.name,
                dataRow.is_main_branch && /* @__PURE__ */ jsx("span", { className: "py-1 ml-4 text-xs badge primary", children: t("core.branch.columns.is_main_branch") })
              ] }),
              /* @__PURE__ */ jsxs("p", { className: "text-sm text-left text-muted-foreground", children: [
                dataRow.shipping_street,
                ", ",
                dataRow.shipping_city,
                ",",
                " ",
                dataRow.shipping_state,
                ", ",
                dataRow.shipping_zip_code,
                ",",
                " ",
                (_a = dataRow.shipping_country) == null ? void 0 : _a.name
              ] })
            ]
          }
        );
      },
      classNameDialog: "max-w-xl!",
      form: /* @__PURE__ */ jsx(Form, {})
    }
  );
}
export {
  Index as default
};
