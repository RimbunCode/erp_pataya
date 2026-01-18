import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { u as useFormPage, T as Textarea, g as FormPageContent, a as FormInput } from "./checkbox-C_BEU5E4.js";
import { useCallback, useMemo } from "react";
import { C as CurrencyInput } from "./CurrencyInput-DtXsGVaN.js";
import { D as DatetimePicker } from "./DatetimePicker-C3h7-5Qi.js";
import { F as FormTable } from "./FormTable-8UNeAa3g.js";
import ItemForm from "./ItemForm-DsSy_Yev.js";
import ItemVariantLinkModel from "./ItemVariantLinkModel-bx0YsOm5.js";
import { S as SelectModel } from "./SelectModel-DOp7Mr8l.js";
import UnitLinkModel from "./UnitLinkModel-2m6CkvAO.js";
import { k as generateRandom } from "./utils-ClCZGsDL.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
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
import "./Header-C9Xb62yg.js";
import "./PermissionLinkModel-Cy7R6yf4.js";
import "./Table2-DWJgyKWG.js";
function Form() {
  const { t } = useLaravelReactI18n();
  const { data, setData, defaultData, disabled } = useFormPage();
  const mergeItems = useCallback(
    (value, model) => {
      setData((prev) => {
        const oldItems = prev.items ?? [];
        const itemMap = new Map(
          oldItems.map((item) => [
            `${item.referenceable_type}_${item.referenceable_id}`,
            item
          ])
        );
        value.forEach((item) => {
          const key = `${model}_${item.id}`;
          const newItem = {
            // ...item,
            id: generateRandom(5),
            item: item.item,
            description: item.description,
            required_date: prev.required_date,
            quantity: item.required_quantity,
            unit: item.unit,
            referenceable_type: model,
            referenceable_id: item.id
          };
          if (newItem.quantity <= 0) {
            itemMap.delete(key);
          }
          if (itemMap.has(key)) {
            itemMap.set(key, {
              ...itemMap.get(key),
              ...newItem
            });
          } else {
            itemMap.set(key, newItem);
          }
        });
        return {
          ...prev,
          items: Array.from(itemMap.values())
        };
      });
    },
    [setData]
  );
  const itemColumns = useMemo(() => {
    return [
      {
        name: "item",
        titleTrans: "purchase.purchaseRequest.columns.item",
        required: true,
        width: 3,
        cell({ dataRow, setData: setData2, attributes }) {
          return /* @__PURE__ */ jsx(
            ItemVariantLinkModel,
            {
              placeholder: t(
                "purchase.purchaseRequest.columns.item.placeholder"
              ),
              value: dataRow == null ? void 0 : dataRow.item,
              onValueChange: (val) => {
                setData2({
                  item: val,
                  unit: val == null ? void 0 : val.default_unit,
                  required_date: data.required_date
                });
              },
              ...attributes,
              with: ["defaultUnit", "item"]
            }
          );
        }
      },
      {
        name: "description",
        titleTrans: "purchase.purchaseRequest.columns.description",
        show: true,
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
        name: "required_date",
        titleTrans: "purchase.purchaseRequest.columns.required_date",
        required: true,
        type: "date",
        width: 1,
        cell({ dataRow, data: data2, setData: setData2, attributes }) {
          return /* @__PURE__ */ jsx(
            DatetimePicker,
            {
              ...attributes,
              disabled: !(dataRow == null ? void 0 : dataRow.item),
              value: data2,
              onValueChange: (value) => {
                setData2("required_date", value);
              }
            }
          );
        }
      },
      {
        name: "quantity",
        titleTrans: "purchase.purchaseRequest.columns.quantity",
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
        titleTrans: "purchase.purchaseRequest.columns.unit",
        required: true,
        cell({ data: data2, setData: setData2, attributes, dataRow }) {
          var _a, _b;
          return /* @__PURE__ */ jsx(
            UnitLinkModel,
            {
              disabled: !(dataRow == null ? void 0 : dataRow.item),
              placeholder: t(
                "purchase.purchaseRequest.columns.unit.placeholder"
              ),
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
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      FormPageContent,
      {
        value: "detail",
        title: t("purchase.purchaseRequest.detail"),
        children: /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-y-4", children: /* @__PURE__ */ jsxs("div", { className: "grid gap-x-4 gap-y-4 md:grid-cols-2", children: [
          /* @__PURE__ */ jsx(
            FormInput,
            {
              label: t("purchase.purchaseRequest.columns.date"),
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
          ),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              label: t("purchase.purchaseRequest.columns.required_date"),
              required: true,
              name: "required_date",
              children: /* @__PURE__ */ jsx(
                DatetimePicker,
                {
                  type: "datetime",
                  value: data.required_date,
                  onValueChange: (val) => {
                    setData((prev) => {
                      var _a;
                      const items = (_a = data == null ? void 0 : data.items) == null ? void 0 : _a.map((item) => {
                        return {
                          ...item,
                          required_date: val
                        };
                      });
                      return {
                        ...prev,
                        required_date: val,
                        items
                      };
                    });
                  }
                }
              )
            }
          )
        ] }) })
      }
    ),
    /* @__PURE__ */ jsx(
      FormPageContent,
      {
        value: "detail",
        title: t("purchase.purchaseRequest.items"),
        actions: !data.submitted_at && /* @__PURE__ */ jsx(
          SelectModel,
          {
            from: {
              "App\\Models\\Service\\WorkOrder": {
                columns: ["code", "date"],
                filters: {
                  status: "submitted"
                },
                select: {
                  items: {
                    filters: {
                      status: "submitted"
                    },
                    columns: [
                      "work_order",
                      "item",
                      "quantity",
                      "required_quantity",
                      "unit"
                    ]
                  }
                }
              }
            },
            label: t("purchase.purchaseRequest.import_items"),
            className: "w-fit",
            variant: "secondary",
            size: "sm",
            onSelected: mergeItems
          }
        ),
        children: /* @__PURE__ */ jsx(
          FormTable,
          {
            readOnly: disabled,
            columns: itemColumns,
            value: data == null ? void 0 : data.items,
            onValueChange: (v) => setData("items", v),
            form: /* @__PURE__ */ jsx(ItemForm, {})
          }
        )
      }
    ),
    /* @__PURE__ */ jsx(
      FormPageContent,
      {
        value: "detail",
        title: t("purchase.purchaseRequest.columns.external_note"),
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
