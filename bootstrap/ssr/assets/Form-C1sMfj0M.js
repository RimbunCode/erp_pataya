import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { u as useFormPage, T as Textarea, g as FormPageContent, a as FormInput, k as FormPageContentTitle } from "./checkbox-C_BEU5E4.js";
import { useMemo } from "react";
import BranchLinkModel from "./BranchLinkModel-C7QCrxBS.js";
import { C as CurrencyInput } from "./CurrencyInput-DtXsGVaN.js";
import CurrencyLinkModel from "./CurrencyLinkModel-u95oYPuj.js";
import CustomerLinkModel from "./CustomerLinkModel-CDws3QaJ.js";
import { D as DatetimePicker } from "./DatetimePicker-C3h7-5Qi.js";
import { F as FormTable } from "./FormTable-8UNeAa3g.js";
import ItemVariantLinkModel from "./ItemVariantLinkModel-bx0YsOm5.js";
import "./PaymentMethodLinkModel-kqgzg9-Y.js";
import "./PaymentTermLinkModel-DeW-CCNL.js";
import SalesOrderLinkModel from "./SalesOrderLinkModel-DiJXrAI9.js";
import { S as Select } from "./Select-DB9toH_t.js";
import TaxLinkModel from "./TaxLinkModel-DN-T_7Az.js";
import UnitLinkModel from "./UnitLinkModel-2m6CkvAO.js";
import WarehouseLinkModel from "./WarehouseLinkModel-CvfxArBc.js";
import { v as calculateArray } from "./utils-ClCZGsDL.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";
import PaymentSchedule from "./PaymentSchedule-Bj4FhgiV.js";
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
import "./Form-B00usptC.js";
import "./CountryLinkModel-sHdBSxco.js";
import "./Form-CMMc7Y6H.js";
import "@dnd-kit/core";
import "@dnd-kit/sortable";
import "@dnd-kit/utilities";
import "./useDynamicRefs-DuDlSZ7v.js";
import "./select-XM4G_Lvw.js";
import "@radix-ui/react-select";
import "react-day-picker";
import "@radix-ui/react-scroll-area";
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
import "./Form-DLossNJm.js";
import "./Form-DVznZ4Aa.js";
import "./Form-DIGwfk9N.js";
import "./Form-BsjjUTga.js";
import "./UserLinkModel-Dt8-ovm1.js";
function Form() {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q;
  const { t } = useLaravelReactI18n();
  const { data, setData, disabled } = useFormPage();
  const { default_currency_id } = usePage().props.preferences;
  const amount = useMemo(() => {
    return calculateArray(data.items, "amount", "+");
  }, [data.items]);
  const basic_amount = useMemo(() => {
    return calculateArray(data.items, "basic_amount", "+");
  }, [data.items]);
  const tax_amount = useMemo(() => {
    return calculateArray(data.items, "tax_amount", "+");
  }, [data.items]);
  const itemColumns = useMemo(() => {
    return [
      {
        name: "item",
        titleTrans: "finances.salesInvoice.columns.item",
        required: true,
        width: 2,
        cell({ dataRow, setData: setData2, attributes }) {
          return /* @__PURE__ */ jsx(
            ItemVariantLinkModel,
            {
              placeholder: t("finances.salesInvoice.columns.item.placeholder"),
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
        titleTrans: "finances.salesInvoice.columns.description",
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
        titleTrans: "finances.salesInvoice.columns.source_warehouse",
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
                "finances.salesInvoice.columns.source_warehouse.placeholder"
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
        titleTrans: "finances.salesInvoice.columns.quantity",
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
        titleTrans: "finances.salesInvoice.columns.unit",
        required: true,
        cell({ data: data2, setData: setData2, attributes, dataRow }) {
          var _a2, _b2;
          return /* @__PURE__ */ jsx(
            UnitLinkModel,
            {
              disabled: !(dataRow == null ? void 0 : dataRow.item),
              placeholder: t("finances.salesInvoice.columns.unit.placeholder"),
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
        titleTrans: "finances.salesInvoice.columns.tax",
        required: true,
        width: 1,
        cell({ data: data2, setData: setData2, attributes, dataRow }) {
          return /* @__PURE__ */ jsx(
            TaxLinkModel,
            {
              disabled: !(dataRow == null ? void 0 : dataRow.item),
              placeholder: t("finances.salesInvoice.columns.tax.placeholder"),
              value: data2,
              onValueChange: (val) => {
                setData2("tax", val);
              },
              ...attributes
            }
          );
        }
      },
      {
        name: "price",
        titleTrans: "finances.salesInvoice.columns.price",
        required: true,
        width: 1,
        cell({ data: price, setData: setData2, attributes, dataRow }) {
          var _a2;
          return /* @__PURE__ */ jsx(
            CurrencyInput,
            {
              decimalScale: 2,
              currencyCode: (_a2 = data == null ? void 0 : data.currency) == null ? void 0 : _a2.code,
              disabled: !(dataRow == null ? void 0 : dataRow.item),
              value: price,
              onValueChange: (val) => {
                setData2("price", val);
              },
              ...attributes
            }
          );
        }
      }
    ];
  }, [data]);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(FormPageContent, { value: "detail", title: t("finances.salesInvoice.detail"), children: /* @__PURE__ */ jsxs("div", { className: "grid gap-x-4 gap-y-4 md:grid-cols-2", children: [
      /* @__PURE__ */ jsx(
        FormInput,
        {
          name: "date",
          label: t("finances.salesInvoice.columns.date"),
          required: true,
          children: /* @__PURE__ */ jsx(
            DatetimePicker,
            {
              type: "datetime",
              value: data == null ? void 0 : data.date,
              onValueChange: (val) => {
                setData("date", val);
              }
            }
          )
        }
      ),
      /* @__PURE__ */ jsx(
        FormInput,
        {
          label: t("finances.salesInvoice.columns.sales_order"),
          name: "sales_order",
          children: /* @__PURE__ */ jsx(
            SalesOrderLinkModel,
            {
              filters: {
                date: {
                  "<=": (data == null ? void 0 : data.date) ?? (/* @__PURE__ */ new Date()).toISOString()
                },
                status: {
                  in: ["to_deliver_and_bill", "to_bill"]
                }
              },
              placeholder: t(
                "finances.salesInvoice.columns.sales_order.placeholder"
              ),
              with: [
                "items",
                "customer",
                "customer_branch",
                "currency",
                "items.item",
                "items.tax",
                "items.unit",
                "items.sourceWarehouse",
                "paymentSchedules",
                "paymentSchedules.paymentTerm",
                "paymentSchedules.paymentMethod"
              ],
              value: data.sales_order,
              onValueChange: (val) => {
                setData((prev) => {
                  return {
                    ...prev,
                    sales_order: val,
                    customer: val == null ? void 0 : val.customer,
                    customer_branch: val == null ? void 0 : val.customer_branch,
                    currency: val == null ? void 0 : val.currency,
                    items: val == null ? void 0 : val.items,
                    paymentSchedules: val == null ? void 0 : val.paymentSchedules,
                    amount: val == null ? void 0 : val.amount,
                    discount_on: val == null ? void 0 : val.discount_on,
                    discount_rate: val == null ? void 0 : val.discount_rate,
                    discount_amount: val == null ? void 0 : val.discount_amount,
                    exchange_rate: val == null ? void 0 : val.exchange_rate,
                    external_note: val == null ? void 0 : val.external_note
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
          className: "col-start-1",
          label: t("finances.salesInvoice.customer"),
          required: true,
          name: "customer",
          readOnly: true,
          children: /* @__PURE__ */ jsx(
            CustomerLinkModel,
            {
              disabled: data.for_internal,
              with: ["branches"],
              value: data.for_internal ? "" : data.customer,
              onValueChange: (val) => {
                var _a2, _b2;
                if (((_a2 = val == null ? void 0 : val.branches) == null ? void 0 : _a2.length) <= 1) {
                  setData("customer_branch", (_b2 = val.branches) == null ? void 0 : _b2[0]);
                }
                setData("customer", val);
              }
            }
          )
        }
      ),
      /* @__PURE__ */ jsx(
        FormInput,
        {
          label: t("finances.salesInvoice.branch"),
          required: true,
          name: "customer_branch",
          readOnly: true,
          children: /* @__PURE__ */ jsx(
            BranchLinkModel,
            {
              disabled: !data.customer,
              value: data.customer_branch,
              onValueChange: (val) => setData("customer_branch", val),
              disabledNavigation: true,
              filters: {
                branchable_type: "App\\Models\\Sales\\Customer",
                branchable_id: ((_a = data.customer) == null ? void 0 : _a.id) ?? null
              }
            }
          )
        }
      ),
      /* @__PURE__ */ jsx(
        FormInput,
        {
          className: "col-start-1",
          label: t("finances.salesInvoice.currency"),
          name: "currency",
          readOnly: true,
          children: /* @__PURE__ */ jsx(
            CurrencyLinkModel,
            {
              placeholder: t("finances.salesInvoice.currency.placeholder"),
              value: data.currency,
              onValueChange: (val) => {
                setData("currency", val);
              }
            }
          )
        }
      ),
      /* @__PURE__ */ jsx(
        FormInput,
        {
          label: t("finances.salesInvoice.exchange_rate"),
          name: "exchange_rate",
          readOnly: true,
          children: /* @__PURE__ */ jsx(
            CurrencyInput,
            {
              disabled: !(((_b = data == null ? void 0 : data.currency) == null ? void 0 : _b.code) && ((_c = data == null ? void 0 : data.currency) == null ? void 0 : _c.code) !== default_currency_id),
              className: "text-left",
              decimalScale: 2,
              value: data.exchange_rate,
              onValueChange: (value) => {
                setData("exchange_rate", value);
              }
            }
          )
        }
      )
    ] }) }),
    /* @__PURE__ */ jsxs(FormPageContent, { value: "detail", title: t("finances.salesInvoice.items"), children: [
      /* @__PURE__ */ jsx(FormPageContentTitle, { className: "flex items-center justify-between gap-x-4", children: t("finances.salesInvoice.items") }),
      /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-x-4 gap-y-4", children: [
        /* @__PURE__ */ jsx(
          FormTable,
          {
            name: "items",
            className: "col-start-1 col-span-2",
            disabled: true,
            columns: itemColumns,
            value: (data == null ? void 0 : data.items) ?? [],
            onValueChange: (v) => setData("items", v),
            mapItem: ({ item }) => {
              var _a2;
              const amount2 = item.quantity * item.price;
              const rateAmount = amount2 * (((_a2 = item.tax) == null ? void 0 : _a2.rate) ?? 0) / 100;
              return {
                ...item,
                tax_amount: rateAmount,
                basic_amount: amount2,
                amount: amount2 + rateAmount
              };
            }
          }
        ),
        ((_d = data == null ? void 0 : data.currency) == null ? void 0 : _d.code) && ((_e = data == null ? void 0 : data.currency) == null ? void 0 : _e.code) !== default_currency_id && /* @__PURE__ */ jsx(
          FormInput,
          {
            readOnly: true,
            label: `${t("finances.salesInvoice.columns.basic_amount")} (${default_currency_id.toUpperCase()})`,
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
            label: `${t("finances.salesInvoice.columns.basic_amount")} (${(((_f = data == null ? void 0 : data.currency) == null ? void 0 : _f.code) ?? default_currency_id).toUpperCase()})`,
            className: "col-start-2",
            children: /* @__PURE__ */ jsx(
              CurrencyInput,
              {
                decimalScale: 2,
                className: "text-right",
                value: basic_amount,
                currencyCode: ((_g = data == null ? void 0 : data.currency) == null ? void 0 : _g.code) ?? "default"
              }
            )
          }
        ),
        ((_h = data == null ? void 0 : data.currency) == null ? void 0 : _h.code) && ((_i = data == null ? void 0 : data.currency) == null ? void 0 : _i.code) !== default_currency_id && /* @__PURE__ */ jsx(
          FormInput,
          {
            readOnly: true,
            label: `${t("finances.salesInvoice.columns.tax_amount")} (${default_currency_id.toUpperCase()})`,
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
            label: `${t("finances.salesInvoice.columns.tax_amount")} (${(((_j = data == null ? void 0 : data.currency) == null ? void 0 : _j.code) ?? default_currency_id).toUpperCase()})`,
            className: "col-start-2",
            children: /* @__PURE__ */ jsx(
              CurrencyInput,
              {
                decimalScale: 2,
                className: "text-right",
                value: tax_amount,
                currencyCode: ((_k = data == null ? void 0 : data.currency) == null ? void 0 : _k.code) ?? "default"
              }
            )
          }
        ),
        ((_l = data == null ? void 0 : data.currency) == null ? void 0 : _l.code) && ((_m = data == null ? void 0 : data.currency) == null ? void 0 : _m.code) !== default_currency_id && /* @__PURE__ */ jsx(
          FormInput,
          {
            readOnly: true,
            label: `${t("finances.salesInvoice.columns.total")} (${default_currency_id.toUpperCase()})`,
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
            label: `${t("finances.salesInvoice.columns.total")} (${(((_n = data == null ? void 0 : data.currency) == null ? void 0 : _n.code) ?? default_currency_id).toUpperCase()})`,
            className: "col-start-2",
            children: /* @__PURE__ */ jsx(
              CurrencyInput,
              {
                className: "text-right",
                decimalScale: 2,
                value: amount,
                currencyCode: ((_o = data == null ? void 0 : data.currency) == null ? void 0 : _o.code) ?? "default"
              }
            )
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsx(
      FormPageContent,
      {
        value: "detail",
        title: t("finances.salesInvoice.columns.additional_discount"),
        collapsible: true,
        defaultOpen: true,
        children: /* @__PURE__ */ jsxs("div", { className: "grid gap-x-4 gap-y-4 md:grid-cols-2", children: [
          /* @__PURE__ */ jsx(FormInput, { label: t("finances.salesInvoice.columns.discount_on"), children: /* @__PURE__ */ jsx(
            Select,
            {
              value: data.discount_on,
              onValueChange: (val) => setData("discount_on", val),
              placeholder: t(
                "finances.salesInvoice.columns.discount_on.placeholder"
              ),
              optionTrans: "finances.salesInvoice.columns.discount_on.options",
              options: ["grand_total", "net_total"]
            }
          ) }),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              disabled: !(data == null ? void 0 : data.discount_on),
              label: `${t("finances.salesInvoice.columns.additional_discount_rate")}`,
              children: /* @__PURE__ */ jsx(
                CurrencyInput,
                {
                  className: "text-right",
                  decimalScale: 2,
                  value: data.discount_rate,
                  suffix: "%",
                  max: 100
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              disabled: !(data == null ? void 0 : data.discount_on),
              label: `${t("finances.salesInvoice.columns.additional_discount_amount")}`,
              className: "col-start-2",
              children: /* @__PURE__ */ jsx(
                CurrencyInput,
                {
                  className: "text-right",
                  decimalScale: 2,
                  value: data.discount_amount,
                  currencyCode: ((_p = data == null ? void 0 : data.currency) == null ? void 0 : _p.code) ?? "default"
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
        title: t("finances.salesInvoice.columns.external_note"),
        collapsible: true,
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
        currencyCode: (_q = data == null ? void 0 : data.currency) == null ? void 0 : _q.code
      }
    )
  ] });
}
export {
  Form as default
};
