import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { u as useFormPage, T as Textarea, g as FormPageContent, a as FormInput } from "./checkbox-C_BEU5E4.js";
import { useMemo, useEffect, useCallback } from "react";
import { S as SelectModel, l as loadFromModel } from "./SelectModel-DOp7Mr8l.js";
import { C as CurrencyInput } from "./CurrencyInput-DtXsGVaN.js";
import CurrencyLinkModel from "./CurrencyLinkModel-u95oYPuj.js";
import { D as DatetimePicker } from "./DatetimePicker-C3h7-5Qi.js";
import { F as FormTable } from "./FormTable-8UNeAa3g.js";
import ItemForm from "./ItemForm-DY08yeJA.js";
import ItemVariantLinkModel from "./ItemVariantLinkModel-bx0YsOm5.js";
import { S as SupplierLinkModel } from "./SupplierLinkModel-BxebTbNh.js";
import UnitLinkModel from "./UnitLinkModel-2m6CkvAO.js";
import { v as calculateArray, k as generateRandom } from "./utils-ClCZGsDL.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";
import WarehouseLinkModel from "./WarehouseLinkModel-CvfxArBc.js";
import PaymentSchedule from "./PaymentSchedule-Bj4FhgiV.js";
import TaxLinkModel from "./TaxLinkModel-DN-T_7Az.js";
import { S as Select } from "./Select-DB9toH_t.js";
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
import "./Header-C9Xb62yg.js";
import "./select-XM4G_Lvw.js";
import "@radix-ui/react-select";
import "./Combobox-CnMmTQqc.js";
import "./drawer-D3vDykaS.js";
import "vaul";
import "@dnd-kit/utilities";
import "@dnd-kit/sortable";
import "./PermissionLinkModel-Cy7R6yf4.js";
import "./Table2-DWJgyKWG.js";
import "@dnd-kit/core";
import "./useDynamicRefs-DuDlSZ7v.js";
import "react-day-picker";
import "@radix-ui/react-scroll-area";
import "./Form-a_UJAbx0.js";
import "./Mention-CB0VqwkR.js";
import "react-mentions";
import "./AttributeLinkModel-ED6Z3erq.js";
import "./Form-Cvx0UpcU.js";
import "./FormBarcodes-BWe8Q1fd.js";
import "./FormDetail-Qe3HBKif.js";
import "./CategoryLinkModel-BHkXUdr5.js";
import "./Form-CjyI6LgW.js";
import "./FormStockLevels-Dn2rbyo9.js";
import "./Form-C_ygZCFM.js";
import "./CountryLinkModel-sHdBSxco.js";
import "./Form-BsjjUTga.js";
import "./BranchLinkModel-C7QCrxBS.js";
import "./Form-B00usptC.js";
import "./UserLinkModel-Dt8-ovm1.js";
import "./PaymentTermLinkModel-DeW-CCNL.js";
import "./Form-DVznZ4Aa.js";
import "./PaymentMethodLinkModel-kqgzg9-Y.js";
import "./Form-DLossNJm.js";
import "./Form-DIGwfk9N.js";
function Form() {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n;
  const { t } = useLaravelReactI18n();
  const { data, setData, defaultData, disabled } = useFormPage();
  const loadFrom = usePage().props.loadFrom;
  const { default_currency_id } = usePage().props.preferences;
  const basic_amount = useMemo(() => {
    return calculateArray(data.items, "basic_amount", "+");
  }, [data.items]);
  const tax_amount = useMemo(() => {
    return calculateArray(data.items, "tax_amount", "+");
  }, [data.items]);
  const amount = useMemo(() => {
    return basic_amount + tax_amount;
  }, [basic_amount, tax_amount]);
  useEffect(() => {
    console.log(data);
  }, [data]);
  const setDiscount = useCallback(
    (key, value) => {
      setData((prev) => {
        let discount_on = prev.discount_on;
        let discount_rate = prev.discount_rate ?? 0;
        let discount_amount = prev.discount_amount ?? 0;
        const basic_amount2 = calculateArray(prev.items, "basic_amount", "+");
        const tax_amount2 = calculateArray(prev.items, "tax_amount", "+");
        if (key == "discount_on") {
          discount_on = value;
        }
        const total = discount_on == "grand_total" ? basic_amount2 + tax_amount2 : discount_on == "net_total" ? basic_amount2 : 0;
        if (key == "discount_rate") {
          discount_rate = value;
          discount_amount = total * discount_rate / 100;
        }
        if (key == "discount_amount") {
          discount_amount = value;
          discount_rate = discount_amount * 100 / total;
        }
        if (key == "discount_on") {
          discount_amount = total * discount_rate / 100;
        }
        return {
          ...prev,
          discount_on,
          discount_rate,
          discount_amount
        };
      });
    },
    [data]
  );
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
            target_warehouse: item.target_warehouse,
            description: item.description,
            required_date: prev.required_date,
            quantity: item.remaining_quantity,
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
  useEffect(() => {
    if (!loadFrom) return;
    const fetchData = async () => {
      const data2 = await loadFromModel(
        loadFrom == null ? void 0 : loadFrom.model,
        loadFrom == null ? void 0 : loadFrom.id,
        loadFrom == null ? void 0 : loadFrom.select
      );
      console.log(data2);
      mergeItems(data2.value, data2.model);
    };
    fetchData().catch(console.error);
  }, [loadFrom, mergeItems]);
  const itemColumns = useMemo(() => {
    return [
      {
        name: "item",
        titleTrans: "purchase.purchaseOrder.columns.item",
        required: true,
        width: 3,
        cell({ dataRow, setData: setData2, attributes }) {
          return /* @__PURE__ */ jsx(
            ItemVariantLinkModel,
            {
              placeholder: t("purchase.purchaseOrder.columns.item.placeholder"),
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
        name: "target_warehouse",
        titleTrans: "purchase.purchaseOrder.columns.target_warehouse",
        required: true,
        type: "text",
        width: 2,
        cell({ dataRow, data: data2, setData: setData2, attributes }) {
          return /* @__PURE__ */ jsx(
            WarehouseLinkModel,
            {
              disabled: !(dataRow == null ? void 0 : dataRow.item),
              rows: 1,
              value: data2 ?? "",
              onValueChange: (val) => setData2("target_warehouse", val),
              ...attributes
            }
          );
        }
      },
      {
        name: "description",
        titleTrans: "purchase.purchaseOrder.columns.description",
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
        titleTrans: "purchase.purchaseOrder.columns.required_date",
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
        titleTrans: "purchase.purchaseOrder.columns.quantity",
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
        titleTrans: "purchase.purchaseOrder.columns.unit",
        required: true,
        cell({ data: data2, setData: setData2, attributes, dataRow }) {
          var _a2, _b2;
          return /* @__PURE__ */ jsx(
            UnitLinkModel,
            {
              disabled: !(dataRow == null ? void 0 : dataRow.item),
              placeholder: t("purchase.purchaseOrder.columns.unit.placeholder"),
              value: data2,
              onValueChange: (val) => setData2("unit", val),
              ...attributes,
              filters: {
                group: (_b2 = (_a2 = dataRow == null ? void 0 : dataRow.item) == null ? void 0 : _a2.default_unit) == null ? void 0 : _b2.group
              }
            }
          );
        }
      },
      {
        name: "tax",
        titleTrans: "purchase.purchaseOrder.columns.tax",
        required: true,
        cell({ data: value, setData: setData2, attributes, dataRow }) {
          var _a2, _b2, _c2;
          return /* @__PURE__ */ jsx(
            TaxLinkModel,
            {
              disabled: !(dataRow == null ? void 0 : dataRow.item),
              currencyCode: (_a2 = data == null ? void 0 : data.currency) == null ? void 0 : _a2.code,
              placeholder: t("purchase.purchaseOrder.columns.tax.placeholder"),
              decimalScale: 2,
              value,
              onValueChange: (val) => setData2({
                tax: val,
                tax_rate: (val == null ? void 0 : val.rate) ?? 0
              }),
              ...attributes,
              filters: {
                group: (_c2 = (_b2 = dataRow == null ? void 0 : dataRow.item) == null ? void 0 : _b2.default_tax) == null ? void 0 : _c2.group
              }
            }
          );
        }
      },
      {
        name: "rate",
        titleTrans: "purchase.purchaseOrder.columns.rate",
        required: true,
        cell({ data: value, setData: setData2, attributes, dataRow }) {
          var _a2, _b2, _c2;
          return /* @__PURE__ */ jsx(
            CurrencyInput,
            {
              disabled: !(dataRow == null ? void 0 : dataRow.item),
              currencyCode: (_a2 = data == null ? void 0 : data.currency) == null ? void 0 : _a2.code,
              placeholder: t("purchase.purchaseOrder.columns.rate.placeholder"),
              decimalScale: 2,
              value,
              onValueChange: (val) => setData2("rate", val),
              ...attributes,
              filters: {
                group: (_c2 = (_b2 = dataRow == null ? void 0 : dataRow.item) == null ? void 0 : _b2.default_rate) == null ? void 0 : _c2.group
              }
            }
          );
        }
      }
    ];
  }, [data.required_date, t]);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(FormPageContent, { value: "detail", children: /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-y-4", children: /* @__PURE__ */ jsxs("div", { className: "grid gap-x-4 gap-y-4 md:grid-cols-2", children: [
      /* @__PURE__ */ jsx(
        FormInput,
        {
          label: t("purchase.purchaseOrder.columns.date"),
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
          label: t("purchase.purchaseOrder.columns.required_date"),
          required: true,
          name: "required_date",
          children: /* @__PURE__ */ jsx(
            DatetimePicker,
            {
              type: "datetime",
              value: data.required_date,
              onValueChange: (val) => {
                setData((prev) => {
                  var _a2;
                  const items = (_a2 = data == null ? void 0 : data.items) == null ? void 0 : _a2.map((item) => {
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
      ),
      /* @__PURE__ */ jsx(
        FormInput,
        {
          label: t("purchase.purchaseOrder.columns.supplier"),
          required: true,
          children: /* @__PURE__ */ jsx(
            SupplierLinkModel,
            {
              value: data.supplier,
              onValueChange: (val) => setData("supplier", val)
            }
          )
        }
      )
    ] }) }) }),
    /* @__PURE__ */ jsx(
      FormPageContent,
      {
        value: "detail",
        title: t("purchase.purchaseOrder.columns.currency"),
        children: /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-x-4", children: [
          /* @__PURE__ */ jsx(
            FormInput,
            {
              className: "col-start-1",
              label: t("purchase.purchaseOrder.columns.currency"),
              name: "currency",
              children: /* @__PURE__ */ jsx(
                CurrencyLinkModel,
                {
                  placeholder: t(
                    "purchase.purchaseOrder.columns.currency.placeholder"
                  ),
                  value: data.currency,
                  onValueChange: (val) => {
                    setData("currency", val);
                  },
                  className: "h-8"
                }
              )
            }
          ),
          data.currency && data.currency.code != default_currency_id && /* @__PURE__ */ jsx(
            FormInput,
            {
              description: `1 ${data.currency.code.toUpperCase()} = [?] ${default_currency_id.toUpperCase()}`,
              label: t("purchase.purchaseOrder.columns.exchange_rate"),
              name: "exchange_rate",
              children: /* @__PURE__ */ jsx(
                CurrencyInput,
                {
                  disabled: !data.currency,
                  className: "text-left",
                  currencyCode: "default",
                  decimalScale: 2,
                  value: data.exchange_rate,
                  onValueChange: (value) => {
                    setData("exchange_rate", value);
                  }
                }
              )
            }
          )
        ] })
      }
    ),
    /* @__PURE__ */ jsx(
      FormPageContent,
      {
        value: "detail",
        title: t("purchase.purchaseOrder.items"),
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
              },
              "App\\Models\\Purchase\\PurchaseRequest": {
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
                      "purchase_request",
                      "item",
                      "quantity",
                      "remaining_quantity",
                      "unit"
                    ]
                  }
                }
              }
            },
            label: t("purchase.purchaseOrder.import_items"),
            className: "w-fit",
            variant: "secondary",
            size: "sm",
            onSelected: mergeItems
          }
        ),
        children: /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-x-4 gap-y-4", children: [
          /* @__PURE__ */ jsx("div", { className: "col-span-full", children: /* @__PURE__ */ jsx(
            FormTable,
            {
              readOnly: disabled,
              columns: itemColumns,
              value: data == null ? void 0 : data.items,
              onValueChange: (v) => setData("items", v),
              form: /* @__PURE__ */ jsx(ItemForm, {}),
              mapItem: ({ item }) => {
                var _a2;
                const amount2 = item.quantity * item.rate;
                const rateAmount = amount2 * (((_a2 = item.tax) == null ? void 0 : _a2.rate) ?? 0) / 100;
                return {
                  ...item,
                  tax_amount: rateAmount,
                  basic_amount: amount2
                };
              }
            }
          ) }),
          ((_a = data == null ? void 0 : data.currency) == null ? void 0 : _a.code) && ((_b = data == null ? void 0 : data.currency) == null ? void 0 : _b.code) !== default_currency_id && /* @__PURE__ */ jsx(
            FormInput,
            {
              readOnly: true,
              label: `${t("purchase.purchaseOrder.columns.basic_amount")} (${default_currency_id.toUpperCase()})`,
              children: /* @__PURE__ */ jsx(
                CurrencyInput,
                {
                  className: "text-right",
                  value: basic_amount * ((data == null ? void 0 : data.exchange_rate) ?? 1),
                  currencyCode: "default"
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              readOnly: true,
              label: `${t("purchase.purchaseOrder.columns.basic_amount")} (${(((_c = data == null ? void 0 : data.currency) == null ? void 0 : _c.code) ?? default_currency_id).toUpperCase()})`,
              className: "col-start-2",
              children: /* @__PURE__ */ jsx(
                CurrencyInput,
                {
                  decimalScale: 2,
                  className: "text-right",
                  value: basic_amount,
                  currencyCode: ((_d = data == null ? void 0 : data.currency) == null ? void 0 : _d.code) ?? "default"
                }
              )
            }
          ),
          ((_e = data == null ? void 0 : data.currency) == null ? void 0 : _e.code) && ((_f = data == null ? void 0 : data.currency) == null ? void 0 : _f.code) !== default_currency_id && /* @__PURE__ */ jsx(
            FormInput,
            {
              readOnly: true,
              label: `${t("purchase.purchaseOrder.columns.tax_amount")} (${default_currency_id.toUpperCase()})`,
              children: /* @__PURE__ */ jsx(
                CurrencyInput,
                {
                  className: "text-right",
                  value: tax_amount * ((data == null ? void 0 : data.exchange_rate) ?? 1),
                  currencyCode: "default"
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              readOnly: true,
              label: `${t("purchase.purchaseOrder.columns.tax_amount")} (${(((_g = data == null ? void 0 : data.currency) == null ? void 0 : _g.code) ?? default_currency_id).toUpperCase()})`,
              className: "col-start-2",
              children: /* @__PURE__ */ jsx(
                CurrencyInput,
                {
                  decimalScale: 2,
                  className: "text-right",
                  value: tax_amount,
                  currencyCode: ((_h = data == null ? void 0 : data.currency) == null ? void 0 : _h.code) ?? "default"
                }
              )
            }
          ),
          ((_i = data == null ? void 0 : data.currency) == null ? void 0 : _i.code) && ((_j = data == null ? void 0 : data.currency) == null ? void 0 : _j.code) !== default_currency_id && /* @__PURE__ */ jsx(
            FormInput,
            {
              readOnly: true,
              label: `${t("purchase.purchaseOrder.columns.total")} (${default_currency_id.toUpperCase()})`,
              children: /* @__PURE__ */ jsx(
                CurrencyInput,
                {
                  className: "text-right",
                  value: amount * ((data == null ? void 0 : data.exchange_rate) ?? 1),
                  currencyCode: "default"
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              readOnly: true,
              label: `${t("purchase.purchaseOrder.columns.total")} (${(((_k = data == null ? void 0 : data.currency) == null ? void 0 : _k.code) ?? default_currency_id).toUpperCase()})`,
              className: "col-start-2",
              children: /* @__PURE__ */ jsx(
                CurrencyInput,
                {
                  className: "text-right",
                  decimalScale: 2,
                  value: amount,
                  currencyCode: ((_l = data == null ? void 0 : data.currency) == null ? void 0 : _l.code) ?? "default"
                }
              )
            }
          )
        ] })
      }
    ),
    /* @__PURE__ */ jsx(
      FormPageContent,
      {
        value: "detail",
        title: t("purchase.purchaseOrder.columns.additional_discount"),
        collapsible: true,
        defaultOpen: true,
        children: /* @__PURE__ */ jsxs("div", { className: "grid gap-x-4 gap-y-4 md:grid-cols-2", children: [
          /* @__PURE__ */ jsx(FormInput, { label: t("purchase.purchaseOrder.columns.discount_on"), children: /* @__PURE__ */ jsx(
            Select,
            {
              value: data.discount_on,
              onValueChange: (val) => setDiscount("discount_on", val),
              placeholder: t(
                "purchase.purchaseOrder.columns.discount_on.placeholder"
              ),
              optionTrans: "purchase.purchaseOrder.columns.discount_on.options",
              options: ["net_total", "grand_total"]
            }
          ) }),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              disabled: !(data == null ? void 0 : data.discount_on),
              label: `${t("purchase.purchaseOrder.columns.additional_discount_rate")}`,
              children: /* @__PURE__ */ jsx(
                CurrencyInput,
                {
                  className: "text-right",
                  value: data.discount_rate,
                  onValueChange: (val) => setDiscount("discount_rate", val),
                  suffix: "%"
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              className: "col-start-2",
              disabled: !(data == null ? void 0 : data.discount_on),
              label: `${t("purchase.purchaseOrder.columns.additional_discount_amount")}`,
              children: /* @__PURE__ */ jsx(
                CurrencyInput,
                {
                  className: "text-right ",
                  decimalScale: 2,
                  value: data.discount_amount,
                  onValueChange: (val) => setDiscount("discount_amount", val),
                  currencyCode: ((_m = data == null ? void 0 : data.currency) == null ? void 0 : _m.code) ?? "default"
                }
              )
            }
          )
        ] })
      }
    ),
    /* @__PURE__ */ jsx(
      FormPageContent,
      {
        value: "detail",
        title: t("purchase.purchaseOrder.columns.external_note"),
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
    ),
    /* @__PURE__ */ jsx(
      PaymentSchedule,
      {
        readOnly: disabled,
        value: (data == null ? void 0 : data.payment_schedules) ?? [],
        onValueChange: (v) => setData("payment_schedules", v),
        mapItem: ({ item }) => {
          const payment_amount = amount * ((item == null ? void 0 : item.invoice_portion) / 100);
          return {
            ...item,
            payment_amount,
            outstanding_amount: payment_amount
          };
        },
        date: data == null ? void 0 : data.date,
        currencyCode: (_n = data == null ? void 0 : data.currency) == null ? void 0 : _n.code
      }
    )
  ] });
}
export {
  Form as default
};
