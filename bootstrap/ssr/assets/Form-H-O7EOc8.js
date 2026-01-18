import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { u as useFormPage, T as Textarea, g as FormPageContent, a as FormInput, F as FormCheckbox } from "./checkbox-C_BEU5E4.js";
import { useRef, useMemo, useCallback } from "react";
import { A as AccountLinkModel } from "./AccountLinkModel-DI4EpSiA.js";
import { C as CurrencyInput } from "./CurrencyInput-DtXsGVaN.js";
import { D as DatetimePicker } from "./DatetimePicker-C3h7-5Qi.js";
import { F as FormTable } from "./FormTable-8UNeAa3g.js";
import ItemVariantLinkModel from "./ItemVariantLinkModel-bx0YsOm5.js";
import { S as Select } from "./Select-DB9toH_t.js";
import UnitLinkModel from "./UnitLinkModel-2m6CkvAO.js";
import WarehouseLinkModel from "./WarehouseLinkModel-CvfxArBc.js";
import { v as calculateArray } from "./utils-ClCZGsDL.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";
import "@radix-ui/react-checkbox";
import "lucide-react";
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
import "lodash";
import "pluralize";
import "react-detect-click-outside";
import "./tabs-DhZjhdeH.js";
import "@radix-ui/react-tabs";
import "./InputError-2JjWc6nJ.js";
import "./label-DiFvdPYz.js";
import "@radix-ui/react-label";
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
import "./Form-BsjjUTga.js";
import "./BranchLinkModel-C7QCrxBS.js";
import "./Form-B00usptC.js";
import "./CountryLinkModel-sHdBSxco.js";
import "./UserLinkModel-Dt8-ovm1.js";
function Form() {
  var _a, _b;
  const { defaultData, data, setData, disabled } = useFormPage();
  const { currentBranch } = usePage().props.branchSettings;
  const { t } = useLaravelReactI18n();
  const itemsTableRef = useRef();
  const totalAdditionalCost = useMemo(() => {
    return calculateArray(data.additional_costs, "amount", "+");
  }, [data.additional_costs]);
  const totalAmount = useMemo(() => {
    return calculateArray(data.items, "basic_amount", "+") + totalAdditionalCost;
  }, [totalAdditionalCost, data.items]);
  const totalQty = useMemo(() => {
    var _a2;
    return calculateArray(
      (_a2 = data.items) == null ? void 0 : _a2.map((item) => ({
        ...item,
        quantity: item.conversion_factor > 1 ? item.quantity * item.conversion_factor : item.quantity / item.conversion_factor
      })),
      "quantity",
      "+"
    );
  }, [data.items]);
  const mappingItem = useCallback(
    ({ item, dataTable, index }, totalCost) => {
      if (disabled) return item;
      const basic_amount = item.basic_rate * item.quantity;
      const newItem = {
        ...item ?? {},
        basic_amount
      };
      if (!dataTable) return newItem;
      dataTable[index] = newItem;
      const totalBasicAmount = calculateArray(dataTable, "basic_amount", "+");
      const totalAdditionalCost2 = calculateArray(
        data.additional_costs,
        "amount",
        "+"
      );
      const qty = item.conversion_factor > 1 ? item.quantity * item.conversion_factor : item.quantity / item.conversion_factor;
      const additional_cost = totalBasicAmount != 0 ? basic_amount / totalBasicAmount * (totalCost ?? totalAdditionalCost2) : 0;
      const valuation_rate = additional_cost / qty + basic_amount / qty;
      const amount = basic_amount + additional_cost;
      return {
        ...item,
        basic_amount,
        additional_cost,
        amount,
        valuation_rate
      };
    },
    [disabled, data.additional_costs]
  );
  const itemColumns = useMemo(() => {
    return [
      {
        name: "item",
        titleTrans: "inventory.stockEntry.item_columns.columns.item",
        required: true,
        width: 2,
        cell({ dataRow, setData: setData2, attributes, reset }) {
          return /* @__PURE__ */ jsx(
            ItemVariantLinkModel,
            {
              placeholder: t(
                "inventory.stockEntry.item_columns.columns.item.placeholder"
              ),
              value: dataRow.item,
              onValueChange: (val) => {
                var _a2;
                if (!val) {
                  reset();
                  return;
                }
                setData2({
                  item: val,
                  unit: val == null ? void 0 : val.default_unit,
                  conversion_factor: (_a2 = val == null ? void 0 : val.default_unit) == null ? void 0 : _a2.conversion_factor,
                  source_warehouse: data.default_source_warehouse ?? void 0,
                  target_warehouse: data.default_target_warehouse ?? void 0
                });
              },
              ...attributes,
              filters: {
                is_stock_item: true
              },
              with: ["defaultUnit", "item"]
            }
          );
        }
      },
      (data.type == "item_transfer" || data.type == "item_consumption" || data.type == "item_issue") && {
        name: "source_warehouse",
        titleTrans: "inventory.stockEntry.item_columns.columns.source_warehouse",
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
                "inventory.stockEntry.item_columns.columns.source_warehouse.placeholder"
              ),
              value: data2,
              onValueChange: (val) => setData2("source_warehouse", val),
              filters: {
                branch_id: (currentBranch == null ? void 0 : currentBranch.is_main_branch) ? void 0 : currentBranch == null ? void 0 : currentBranch.id
              },
              ...attributes
            }
          );
        }
      },
      (data.type == "item_transfer" || data.type == "item_receipt") && {
        name: "target_warehouse",
        titleTrans: "inventory.stockEntry.item_columns.columns.target_warehouse",
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
                "inventory.stockEntry.item_columns.columns.target_warehouse.placeholder"
              ),
              value: data2,
              onValueChange: (val) => setData2("target_warehouse", val),
              ...attributes,
              filters: {
                branch_id: (currentBranch == null ? void 0 : currentBranch.is_main_branch) ? void 0 : currentBranch == null ? void 0 : currentBranch.id
              }
            }
          );
        }
      },
      {
        name: "description",
        titleTrans: "inventory.stockEntry.item_columns.columns.description",
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
        name: "quantity",
        titleTrans: "inventory.stockEntry.item_columns.columns.quantity",
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
              decimalScale: 2,
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
        titleTrans: "inventory.stockEntry.item_columns.columns.unit",
        cell({ data: data2, setData: setData2, attributes, dataRow }) {
          var _a2, _b2;
          return /* @__PURE__ */ jsx(
            UnitLinkModel,
            {
              disabled: !(dataRow == null ? void 0 : dataRow.item),
              placeholder: t(
                "inventory.stockEntry.item_columns.columns.unit.placeholder"
              ),
              value: data2,
              onValueChange: (val) => setData2({
                unit: val,
                conversion_factor: val == null ? void 0 : val.conversion_factor
              }),
              ...attributes,
              filters: {
                group: (_b2 = (_a2 = dataRow == null ? void 0 : dataRow.item) == null ? void 0 : _a2.default_unit) == null ? void 0 : _b2.group
              }
            }
          );
        }
      },
      {
        name: "basic_rate",
        titleTrans: "inventory.stockEntry.item_columns.columns.basic_rate",
        required: data.type == "item_receipt",
        show: true,
        width: 2,
        type: "number",
        cell({ dataRow, setData: setData2, attributes }) {
          return /* @__PURE__ */ jsx(
            CurrencyInput,
            {
              ...attributes,
              disabled: !(dataRow == null ? void 0 : dataRow.item),
              readOnly: data.type != "item_receipt",
              value: dataRow.basic_rate,
              onValueChange: (val) => setData2("basic_rate", val),
              currencyCode: "default",
              decimalScale: 2
            }
          );
        }
      },
      {
        name: "basic_amount",
        titleTrans: "inventory.stockEntry.item_columns.columns.basic_amount",
        disabled: true,
        type: "number",
        cell({ dataRow, attributes }) {
          return /* @__PURE__ */ jsx(
            CurrencyInput,
            {
              ...attributes,
              disabled: !(dataRow == null ? void 0 : dataRow.item) || attributes.disabled,
              value: dataRow.basic_amount,
              currencyCode: "default",
              decimalScale: 2
            }
          );
        }
      },
      ...(data == null ? void 0 : data.type) == "item_transfer" || (data == null ? void 0 : data.type) == "item_receipt" ? [
        {
          name: "additional_cost",
          titleTrans: "inventory.stockEntry.item_columns.columns.additional_cost",
          disabled: true,
          type: "number",
          cell({ dataRow, attributes }) {
            return /* @__PURE__ */ jsx(
              CurrencyInput,
              {
                ...attributes,
                disabled: !(dataRow == null ? void 0 : dataRow.item) || attributes.disabled,
                value: dataRow.additional_cost,
                currencyCode: "default",
                decimalScale: 2
              }
            );
          }
        },
        {
          name: "valuation_rate",
          titleTrans: "inventory.stockEntry.item_columns.columns.valuation_rate",
          disabled: true,
          type: "number",
          cell({ dataRow, attributes }) {
            return /* @__PURE__ */ jsx(
              CurrencyInput,
              {
                ...attributes,
                disabled: !(dataRow == null ? void 0 : dataRow.item) || attributes.disabled,
                value: dataRow.valuation_rate,
                currencyCode: "default",
                decimalScale: 2
              }
            );
          }
        },
        {
          name: "amount",
          titleTrans: "inventory.stockEntry.item_columns.columns.amount",
          disabled: true,
          type: "number",
          cell({ dataRow, attributes }) {
            return /* @__PURE__ */ jsx(
              CurrencyInput,
              {
                ...attributes,
                disabled: !(dataRow == null ? void 0 : dataRow.item) || attributes.disabled,
                value: dataRow.amount,
                currencyCode: "default",
                decimalScale: 2
              }
            );
          }
        }
      ] : []
    ];
  }, [data, currentBranch]);
  const additionalCostColumns = useMemo(() => {
    return [
      {
        name: "expense_account",
        required: true,
        titleTrans: "finances.additionalCost.columns.expense_account",
        cell({ data: data2, setData: setData2, attributes }) {
          return /* @__PURE__ */ jsx(
            AccountLinkModel,
            {
              onValueChange: (val) => setData2("expense_account", val),
              value: data2,
              filters: {
                account_type: {
                  in: [
                    "tax",
                    "chargeable",
                    "income_account",
                    "expenses_included_in_valuation",
                    "expenses_included_in_asset_valuation"
                  ]
                }
              },
              ...attributes
            }
          );
        }
      },
      {
        name: "purpose",
        titleTrans: "finances.additionalCost.columns.purpose",
        type: "text",
        required: true,
        width: 2,
        cell({ data: data2, setData: setData2, attributes }) {
          return /* @__PURE__ */ jsx(
            Textarea,
            {
              rows: 1,
              value: data2 ?? "",
              onChange: (e) => setData2("purpose", e.target.value),
              ...attributes
            }
          );
        }
      },
      {
        name: "amount",
        titleTrans: "finances.additionalCost.columns.amount",
        required: true,
        type: "number",
        width: 1,
        cell({ data: data2, setData: setData2, attributes }) {
          return /* @__PURE__ */ jsx(
            CurrencyInput,
            {
              ...attributes,
              currencyCode: "default",
              decimalScale: 2,
              value: data2,
              onValueChange: (value) => {
                setData2("amount", value);
              }
            }
          );
        }
      }
    ];
  }, []);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(FormPageContent, { title: t("inventory.stockEntry.detail"), value: "detail", children: /* @__PURE__ */ jsxs("div", { className: "grid gap-x-4 gap-y-4 md:grid-cols-2", children: [
      /* @__PURE__ */ jsx(
        FormInput,
        {
          label: t("inventory.stockEntry.columns.date"),
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
          label: t("inventory.stockEntry.columns.type"),
          required: true,
          name: "type",
          children: /* @__PURE__ */ jsx(
            Select,
            {
              value: data.type,
              onValueChange: (val) => setData("type", val),
              placeholder: t("inventory.stockEntry.columns.type.placeholder"),
              optionTrans: "inventory.stockEntry.types",
              options: ["item_transfer", "item_receipt", "item_issue"]
            }
          )
        }
      ),
      data.type == "item_transfer" && /* @__PURE__ */ jsx(
        FormCheckbox,
        {
          className: "col-start-2",
          label: t("inventory.stockEntry.columns.using_transit"),
          name: "using_transit",
          checked: data.using_transit,
          onCheckedChange: (val) => setData("using_transit", val)
        }
      )
    ] }) }),
    /* @__PURE__ */ jsx(
      FormPageContent,
      {
        value: "detail",
        title: t("inventory.stockEntry.accounting"),
        children: /* @__PURE__ */ jsx("div", { className: "grid gap-x-4 gap-y-4 md:grid-cols-2 grid-cols-1", children: /* @__PURE__ */ jsx(
          FormInput,
          {
            required: true,
            label: t("inventory.stockEntry.columns.difference_account"),
            children: /* @__PURE__ */ jsx(
              AccountLinkModel,
              {
                value: data.difference_account,
                onValueChange: (val) => setData("difference_account", val),
                filters: {
                  is_group: false,
                  root_type: {
                    in: ["liability", "equity", "expense"]
                  }
                },
                defaultValue: {
                  root_type: "expense",
                  account_type: "stock_adjustment"
                }
              }
            )
          }
        ) })
      }
    ),
    /* @__PURE__ */ jsx(FormPageContent, { title: t("inventory.stockEntry.items"), value: "detail", children: /* @__PURE__ */ jsxs("div", { className: "grid gap-x-4 gap-y-4 md:grid-cols-2 ", children: [
      (data.type == "item_transfer" || data.type == "item_issue" || data.type == "item_consumption") && /* @__PURE__ */ jsx(
        FormInput,
        {
          label: t("inventory.stockEntry.columns.default_source_warehouse"),
          children: /* @__PURE__ */ jsx(
            WarehouseLinkModel,
            {
              value: data.default_source_warehouse,
              onValueChange: (val) => setData((prev) => {
                var _a2;
                return {
                  ...prev,
                  default_source_warehouse: val,
                  items: (_a2 = prev.items) == null ? void 0 : _a2.map((item) => {
                    return {
                      ...item,
                      source_warehouse: val
                    };
                  })
                };
              }),
              filters: {
                branch_id: data.branch_id,
                id: {
                  not: (_a = data.default_target_warehouse) == null ? void 0 : _a.id
                }
              }
            }
          )
        }
      ),
      (data.type == "item_transfer" || data.type == "item_receipt") && /* @__PURE__ */ jsx(
        FormInput,
        {
          label: t("inventory.stockEntry.columns.default_target_warehouse"),
          children: /* @__PURE__ */ jsx(
            WarehouseLinkModel,
            {
              value: data.default_target_warehouse,
              onValueChange: (val) => setData((prev) => {
                var _a2;
                return {
                  ...prev,
                  default_target_warehouse: val,
                  items: (_a2 = prev.items) == null ? void 0 : _a2.map((item) => {
                    return {
                      ...item,
                      target_warehouse: val
                    };
                  })
                };
              }),
              filters: {
                branch_id: data.branch_id,
                id: {
                  not: (_b = data.default_source_warehouse) == null ? void 0 : _b.id
                }
              }
            }
          )
        }
      ),
      /* @__PURE__ */ jsx(
        FormTable,
        {
          ref: itemsTableRef,
          className: "col-span-full",
          name: "items",
          readOnly: disabled,
          columns: itemColumns,
          value: (data == null ? void 0 : data.items) ?? [],
          onValueChange: (v) => setData("items", v),
          mapItem: mappingItem
        }
      ),
      /* @__PURE__ */ jsx(FormInput, { label: t("inventory.stockEntry.columns.total_quantity"), children: /* @__PURE__ */ jsx(CurrencyInput, { readOnly: true, decimalScale: 2, value: totalQty }) }),
      /* @__PURE__ */ jsx(FormInput, { label: t("inventory.stockEntry.columns.total_amount"), children: /* @__PURE__ */ jsx(CurrencyInput, { readOnly: true, decimalScale: 2, value: totalAmount }) })
    ] }) }),
    /* @__PURE__ */ jsx(
      FormPageContent,
      {
        title: t("inventory.stockEntry.columns.notes"),
        value: "detail",
        collapsible: true,
        defaultOpen: defaultData == null ? void 0 : defaultData.notes,
        children: /* @__PURE__ */ jsx(FormInput, { name: "notes", children: /* @__PURE__ */ jsx(
          Textarea,
          {
            value: data.notes,
            onChange: (e) => setData("notes", e.target.value)
          }
        ) })
      }
    ),
    /* @__PURE__ */ jsxs(
      FormPageContent,
      {
        title: t("inventory.stockEntry.additional_costs"),
        value: "additional_costs",
        show: !(data.type == null || data.type == "item_issue" || data.type == "item_consumption"),
        children: [
          /* @__PURE__ */ jsx(
            FormTable,
            {
              name: "additional_costs",
              readOnly: disabled,
              columns: additionalCostColumns,
              value: (data == null ? void 0 : data.additional_costs) ?? [],
              onValueChange: (v) => {
                setData((prev) => {
                  var _a2;
                  const newData = {
                    ...prev,
                    additional_costs: v
                  };
                  return {
                    ...newData,
                    items: (_a2 = prev.items) == null ? void 0 : _a2.map((item, index) => {
                      return mappingItem(
                        {
                          item,
                          dataTable: newData.items,
                          index
                        },
                        calculateArray(v, "amount", "+")
                      );
                    })
                  };
                });
              }
            }
          ),
          /* @__PURE__ */ jsx("div", { className: "grid grid-cols-3 mt-4", children: /* @__PURE__ */ jsx(
            FormInput,
            {
              label: t("finances.additionalCost.columns.total"),
              name: "total",
              className: "md:col-start-3 col-start-2 col-span-2",
              children: /* @__PURE__ */ jsx(
                CurrencyInput,
                {
                  currencyCode: "default",
                  decimalScale: 2,
                  value: totalAdditionalCost
                }
              )
            }
          ) })
        ]
      }
    )
  ] });
}
export {
  Form as default
};
