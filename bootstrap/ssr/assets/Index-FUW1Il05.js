import { jsx, jsxs } from "react/jsx-runtime";
import { B as Button } from "./button-Us2TB7GG.js";
import DataTable2 from "./DataTable2-sz-ATj9o.js";
import Form from "./Form-a_UJAbx0.js";
import { L as Link } from "./Link-p0Z4AKax.js";
import { Trash2Icon } from "lucide-react";
import { u as useDeleteModal } from "./MasterLayout-CRsmljQs.js";
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
import "laravel-react-i18n";
import "@inertiajs/react";
import "./select-XM4G_Lvw.js";
import "@radix-ui/react-select";
import "./tooltip-Df8khweJ.js";
import "@radix-ui/react-tooltip";
import "./AppLayout-Drqdr6Z-.js";
import "./command-BSnyCa9u.js";
import "@radix-ui/react-dialog";
import "./use-mobile-BsFue-bT.js";
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
import "zustand";
import "@remixicon/react";
import "./Tags-D6pM3ZUY.js";
import "@marcbachmann/cel-js";
import "sonner";
import "@dnd-kit/utilities";
import "@dnd-kit/sortable";
import "./Table2-DWJgyKWG.js";
import "@dnd-kit/core";
import "./useDynamicRefs-DuDlSZ7v.js";
import "@radix-ui/react-alert-dialog";
import "./Mention-CB0VqwkR.js";
import "react-mentions";
import "./AttributeLinkModel-ED6Z3erq.js";
import "./Form-Cvx0UpcU.js";
import "./FormTable-8UNeAa3g.js";
import "./CurrencyInput-DtXsGVaN.js";
import "./FormBarcodes-BWe8Q1fd.js";
import "./UnitLinkModel-2m6CkvAO.js";
import "./Form-C_ygZCFM.js";
import "./FormDetail-Qe3HBKif.js";
import "./CategoryLinkModel-BHkXUdr5.js";
import "./Form-CjyI6LgW.js";
import "./FormStockLevels-Dn2rbyo9.js";
function Index() {
  const route = window.route;
  const { deleteItem } = useDeleteModal();
  return /* @__PURE__ */ jsx(
    DataTable2,
    {
      templateItem: ({ dataRow }) => /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between p-4 border-b gap-x-4 border-muted-foreground/25", children: [
        /* @__PURE__ */ jsx(
          Link,
          {
            as: "button",
            href: dataRow.id ? route("items.show", dataRow.id) : "",
            className: "",
            children: /* @__PURE__ */ jsx("p", { className: "text-base font-medium text-left", children: dataRow.name })
          }
        ),
        /* @__PURE__ */ jsx(
          Button,
          {
            variant: "destructive",
            size: "icon",
            className: "size-8",
            onClick: () => deleteItem("items.destroy", dataRow.id),
            children: /* @__PURE__ */ jsx(Trash2Icon, {})
          }
        )
      ] }),
      classNameDialog: "max-w-6xl!",
      form: /* @__PURE__ */ jsx(Form, {})
    }
  );
}
export {
  Index as default
};
