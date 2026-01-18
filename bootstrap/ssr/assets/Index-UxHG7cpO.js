import { jsx, Fragment } from "react/jsx-runtime";
import { B as Button } from "./button-Us2TB7GG.js";
import { Trash2Icon } from "lucide-react";
import DataTable2 from "./DataTable2-sz-ATj9o.js";
import { u as useDeleteModal } from "./MasterLayout-CRsmljQs.js";
import Form from "./Form-TRZzA-uq.js";
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
import "./Link-p0Z4AKax.js";
import "@inertiajs/core";
import "zustand";
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
import "./CurrencyInput-DtXsGVaN.js";
import "./CurrencyLinkModel-u95oYPuj.js";
import "./CustomerLinkModel-CDws3QaJ.js";
import "./Form-CMMc7Y6H.js";
import "./Form-B00usptC.js";
import "./CountryLinkModel-sHdBSxco.js";
import "./FormTable-8UNeAa3g.js";
import "./PaymentMethodLinkModel-kqgzg9-Y.js";
import "./Form-DLossNJm.js";
import "./SupplierLinkModel-BxebTbNh.js";
function Index() {
  const { deleteItem } = useDeleteModal();
  return /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsx(
    DataTable2,
    {
      actions: ({ dataRow }) => {
        if (dataRow.is_default) return null;
        return /* @__PURE__ */ jsx(
          Button,
          {
            variant: "destructive",
            size: "icon",
            className: "size-8",
            onClick: () => deleteItem("paymentEntries.destroy", dataRow.id),
            children: /* @__PURE__ */ jsx(Trash2Icon, {})
          }
        );
      },
      form: /* @__PURE__ */ jsx(Form, {}),
      classNameDialog: "max-w-screen-2xl"
    }
  ) });
}
export {
  Index as default
};
