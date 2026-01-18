import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { u as useFormPage, T as Textarea, g as FormPageContent, a as FormInput } from "./checkbox-C_BEU5E4.js";
import { useMemo, useEffect } from "react";
import { C as CurrencyInput } from "./CurrencyInput-DtXsGVaN.js";
import { D as DatetimePicker } from "./DatetimePicker-C3h7-5Qi.js";
import { F as FormTable } from "./FormTable-8UNeAa3g.js";
import ItemVariantLinkModel from "./ItemVariantLinkModel-bx0YsOm5.js";
import UnitLinkModel from "./UnitLinkModel-2m6CkvAO.js";
import WarehouseLinkModel from "./WarehouseLinkModel-CvfxArBc.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
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
import "./select-XM4G_Lvw.js";
import "@radix-ui/react-select";
import "react-day-picker";
import "@radix-ui/react-scroll-area";
import "@dnd-kit/core";
import "@dnd-kit/sortable";
import "@dnd-kit/utilities";
import "./useDynamicRefs-DuDlSZ7v.js";
import "./Form-a_UJAbx0.js";
import "./Mention-CB0VqwkR.js";
import "react-mentions";
import "./AttributeLinkModel-ED6Z3erq.js";
import "./Form-Cvx0UpcU.js";
import "./FormBarcodes-BWe8Q1fd.js";
import "./Form-C_ygZCFM.js";
import "./Combobox-CnMmTQqc.js";
import "./drawer-D3vDykaS.js";
import "vaul";
import "./FormDetail-Qe3HBKif.js";
import "./CategoryLinkModel-BHkXUdr5.js";
import "./Form-CjyI6LgW.js";
import "./FormStockLevels-Dn2rbyo9.js";
import "./Form-BsjjUTga.js";
import "./BranchLinkModel-C7QCrxBS.js";
import "./Form-B00usptC.js";
import "./CountryLinkModel-sHdBSxco.js";
import "./UserLinkModel-Dt8-ovm1.js";
function Form() {
  const { t } = useLaravelReactI18n();
  const { data, setData, defaultData, disabled } = useFormPage();
  const itemColumns = useMemo(() => {
    return [
      {
        name: "item",
        titleTrans: "sales.internalOrder.columns.item",
        required: true,
        width: 2,
        cell({ dataRow, setData: setData2, attributes }) {
          return /* @__PURE__ */ jsx(
            ItemVariantLinkModel,
            {
              placeholder: t("sales.internalOrder.columns.item.placeholder"),
              value: dataRow.item,
              onValueChange: (val) => {
                setData2({
                  item: val,
                  unit: val == null ? void 0 : val.default_unit,
                  source_warehouse: data.source_warehouse
                });
              },
              ...attributes,
              filters: {
                category: {
                  type: {
                    in: ["service", "stock"]
                  }
                }
              },
              with: ["defaultUnit", "item"]
            }
          );
        }
      },
      {
        name: "description",
        titleTrans: "sales.internalOrder.columns.description",
        show: false,
        type: "text",
        width: 2,
        cell({ dataRow, data: data2, setData: setData2, attributes }) {
          return /* @__PURE__ */ jsx(
            Textarea,
            {
              disabled: !(dataRow == null ? void 0 : dataRow.item),
              rows: 1,
              value: data2 ?? "",
              onChange: (e) => setData2("description", e.target.value),
              ...attributes
            }
          );
        }
      },
      {
        name: "source_warehouse",
        titleTrans: "sales.internalOrder.columns.source_warehouse",
        show: true,
        type: "text",
        width: 2,
        required: true,
        cell({ dataRow, data: data2, setData: setData2, attributes }) {
          return /* @__PURE__ */ jsx(
            WarehouseLinkModel,
            {
              disabled: !(dataRow == null ? void 0 : dataRow.item),
              placeholder: t(
                "sales.internalOrder.columns.source_warehouse.placeholder"
              ),
              value: data2,
              onValueChange: (val) => setData2("source_warehouse", val),
              ...attributes
            }
          );
        }
      },
      {
        name: "quantity",
        titleTrans: "sales.internalOrder.columns.quantity",
        required: true,
        type: "number",
        width: 1,
        cell({ dataRow, data: data2, setData: setData2, attributes }) {
          return /* @__PURE__ */ jsx(
            CurrencyInput,
            {
              ...attributes,
              disabled: !(dataRow == null ? void 0 : dataRow.item),
              readOnly: attributes.readOnly || dataRow.readOnly && !dataRow.isCustom,
              value: data2,
              onValueChange: (value) => {
                setData2("quantity", value);
              }
            }
          );
        }
      },
      {
        name: "unit",
        titleTrans: "sales.internalOrder.columns.unit",
        required: true,
        cell({ data: data2, setData: setData2, attributes, dataRow }) {
          var _a, _b;
          return /* @__PURE__ */ jsx(
            UnitLinkModel,
            {
              disabled: !(dataRow == null ? void 0 : dataRow.item),
              placeholder: t("sales.internalOrder.columns.unit.placeholder"),
              value: data2,
              onValueChange: (val) => setData2("unit", val),
              ...attributes,
              filters: {
                group: (_b = (_a = dataRow == null ? void 0 : dataRow.item) == null ? void 0 : _a.default_unit) == null ? void 0 : _b.group
              }
            }
          );
        }
      }
    ];
  }, []);
  useEffect(() => {
    if (!data.date) {
      setData("date", /* @__PURE__ */ new Date());
    }
  }, []);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(FormPageContent, { value: "detail", title: t("sales.internalOrder.detail"), children: /* @__PURE__ */ jsx("div", { className: "grid gap-x-4 gap-y-4 md:grid-cols-2", children: /* @__PURE__ */ jsx(
      FormInput,
      {
        label: t("sales.internalOrder.columns.date"),
        required: true,
        name: "date",
        children: /* @__PURE__ */ jsx(
          DatetimePicker,
          {
            type: "datetime",
            value: data.date,
            onValueChange: (val) => setData("date", val)
          }
        )
      }
    ) }) }),
    /* @__PURE__ */ jsx(FormPageContent, { value: "detail", title: t("sales.internalOrder.items"), children: /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-x-4 gap-y-4", children: [
      /* @__PURE__ */ jsx(
        FormInput,
        {
          label: t("sales.internalOrder.columns.source_warehouse"),
          name: "source_warehouse",
          children: /* @__PURE__ */ jsx(
            WarehouseLinkModel,
            {
              placeholder: t(
                "sales.internalOrder.columns.source_warehouse.placeholder"
              ),
              value: data.source_warehouse,
              onValueChange: (val) => {
                setData((prev) => {
                  const newItems = prev.items.map((item) => {
                    return {
                      ...item,
                      source_warehouse: val
                    };
                  });
                  return {
                    ...prev,
                    items: newItems,
                    source_warehouse: val
                  };
                });
              }
            }
          )
        }
      ),
      /* @__PURE__ */ jsx(
        FormTable,
        {
          className: "col-start-1 col-span-2",
          readOnly: disabled,
          columns: itemColumns,
          value: (data == null ? void 0 : data.items) ?? [],
          onValueChange: (v) => setData("items", v)
        }
      )
    ] }) }),
    /* @__PURE__ */ jsx(
      FormPageContent,
      {
        value: "detail",
        title: t("sales.internalOrder.columns.external_note"),
        collapsible: true,
        defaultOpen: defaultData == null ? void 0 : defaultData.external_note,
        children: /* @__PURE__ */ jsx("div", { className: "px-1 py-1", children: /* @__PURE__ */ jsx(FormInput, { children: /* @__PURE__ */ jsx(
          Textarea,
          {
            rows: 3,
            value: data.external_note ?? "",
            onChange: (e) => setData("external_note", e.target.value)
          }
        ) }) })
      }
    )
  ] });
}
export {
  Form as default
};
