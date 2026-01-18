import { jsx } from "react/jsx-runtime";
import { u as useFormPage, g as FormPageContent } from "./checkbox-C_BEU5E4.js";
import { memo, useMemo } from "react";
import { F as FormTable } from "./FormTable-8UNeAa3g.js";
import UnitLinkModel from "./UnitLinkModel-2m6CkvAO.js";
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
import "./input-wk3Ou7wI.js";
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
import "@dnd-kit/core";
import "@dnd-kit/sortable";
import "@dnd-kit/utilities";
import "./CurrencyInput-DtXsGVaN.js";
import "./useDynamicRefs-DuDlSZ7v.js";
import "./Form-C_ygZCFM.js";
import "./Combobox-CnMmTQqc.js";
import "./drawer-D3vDykaS.js";
import "vaul";
const FormBarcodes = memo(function FormBarcodes2({ disabled, isVariant = false }) {
  const { data, setData } = useFormPage();
  const item = usePage().props.item;
  const { t } = useLaravelReactI18n();
  const barcodeColumns = useMemo(
    () => [
      {
        name: "barcode",
        titleTrans: "inventory.item.columns.barcodes.columns.barcode",
        required: true
      },
      {
        name: "unit",
        titleTrans: "inventory.item.columns.barcodes.columns.unit",
        required: true,
        cell({ dataRow, data: value, setData: setData2, attributes }) {
          var _a, _b, _c, _d;
          return /* @__PURE__ */ jsx(
            UnitLinkModel,
            {
              ...attributes,
              readOnly: !dataRow.barcode,
              value,
              onValueChange: (val) => {
                setData2("unit", val);
              },
              filters: {
                group: isVariant ? (_a = item == null ? void 0 : item.default_unit) == null ? void 0 : _a.group : (_b = data == null ? void 0 : data.default_unit) == null ? void 0 : _b.group
              },
              defaultValueForm: {
                group: isVariant ? (_c = item == null ? void 0 : item.default_unit) == null ? void 0 : _c.group : (_d = data == null ? void 0 : data.default_unit) == null ? void 0 : _d.group
              }
            }
          );
        }
      }
    ],
    [isVariant, data, item]
  );
  return /* @__PURE__ */ jsx(
    FormPageContent,
    {
      title: t("inventory.item.menu.barcodes"),
      value: "barcodes",
      show: item && !(item.attributes && item.attributes.length > 0),
      children: /* @__PURE__ */ jsx(
        FormTable,
        {
          disabled,
          columns: barcodeColumns,
          value: data.barcodes ?? [],
          onValueChange: (val) => {
            setData("barcodes", val);
          }
        }
      )
    }
  );
});
export {
  FormBarcodes as default
};
