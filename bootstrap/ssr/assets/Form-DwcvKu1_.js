import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { u as useFormPage, T as Textarea, g as FormPageContent, a as FormInput, k as FormPageContentTitle } from "./checkbox-C_BEU5E4.js";
import { useMemo, useEffect } from "react";
import { C as CurrencyInput } from "./CurrencyInput-DtXsGVaN.js";
import CurrencyLinkModel from "./CurrencyLinkModel-u95oYPuj.js";
import { D as DatetimePicker } from "./DatetimePicker-C3h7-5Qi.js";
import { F as FormTable } from "./FormTable-8UNeAa3g.js";
import ItemVariantLinkModel from "./ItemVariantLinkModel-bx0YsOm5.js";
import PaymentMethodLinkModel from "./PaymentMethodLinkModel-kqgzg9-Y.js";
import PaymentTermLinkModel from "./PaymentTermLinkModel-DeW-CCNL.js";
import { S as Select } from "./Select-DB9toH_t.js";
import TaxLinkModel from "./TaxLinkModel-DN-T_7Az.js";
import UnitLinkModel from "./UnitLinkModel-2m6CkvAO.js";
import WarehouseLinkModel from "./WarehouseLinkModel-CvfxArBc.js";
import { v as calculateArray, k as generateRandom } from "./utils-ClCZGsDL.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";
import { S as SupplierLinkModel } from "./SupplierLinkModel-BxebTbNh.js";
import PurchaseOrderLinkModel from "./PurchaseOrderLinkModel-O-uRbF1B.js";
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
import "./FormDetail-Qe3HBKif.js";
import "./CategoryLinkModel-BHkXUdr5.js";
import "./Form-CjyI6LgW.js";
import "./FormStockLevels-Dn2rbyo9.js";
import "./Form-DLossNJm.js";
import "./Form-DVznZ4Aa.js";
import "./Form-DIGwfk9N.js";
import "./Form-C_ygZCFM.js";
import "./Combobox-CnMmTQqc.js";
import "./drawer-D3vDykaS.js";
import "vaul";
import "./Form-BsjjUTga.js";
import "./BranchLinkModel-C7QCrxBS.js";
import "./Form-B00usptC.js";
import "./CountryLinkModel-sHdBSxco.js";
import "./UserLinkModel-Dt8-ovm1.js";
import "./Form-V5XwpDQA.js";
import "./SelectModel-DOp7Mr8l.js";
import "./Header-C9Xb62yg.js";
import "./PermissionLinkModel-Cy7R6yf4.js";
import "./Table2-DWJgyKWG.js";
import "./ItemForm-DY08yeJA.js";
import "./PaymentSchedule-Bj4FhgiV.js";
function Form() {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o;
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
        titleTrans: "finances.purchaseInvoice.columns.item",
        required: true,
        width: 2,
        cell({ dataRow, setData: setData2, attributes }) {
          return /* @__PURE__ */ jsx(
            ItemVariantLinkModel,
            {
              placeholder: t(
                "finances.purchaseInvoice.columns.item.placeholder"
              ),
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
        titleTrans: "finances.purchaseInvoice.columns.description",
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
        name: "target_warehouse",
        titleTrans: "finances.purchaseInvoice.columns.target_warehouse",
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
                "finances.purchaseInvoice.columns.target_warehouse.placeholder"
              ),
              value: data2,
              onValueChange: (val) => setData2("target_warehouse", val),
              ...attributes
            }
          );
        }
      },
      {
        name: "quantity",
        titleTrans: "finances.purchaseInvoice.columns.quantity",
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
        titleTrans: "finances.purchaseInvoice.columns.unit",
        required: true,
        cell({ data: data2, setData: setData2, attributes, dataRow }) {
          var _a2, _b2;
          return /* @__PURE__ */ jsx(
            UnitLinkModel,
            {
              disabled: !(dataRow == null ? void 0 : dataRow.item),
              placeholder: t(
                "finances.purchaseInvoice.columns.unit.placeholder"
              ),
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
        titleTrans: "finances.purchaseInvoice.columns.tax",
        required: true,
        width: 1,
        cell({ data: data2, setData: setData2, attributes, dataRow }) {
          return /* @__PURE__ */ jsx(
            TaxLinkModel,
            {
              disabled: !(dataRow == null ? void 0 : dataRow.item),
              placeholder: t(
                "finances.purchaseInvoice.columns.tax.placeholder"
              ),
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
        name: "rate",
        titleTrans: "finances.purchaseInvoice.columns.rate",
        required: true,
        width: 1,
        cell({ data: rate, setData: setData2, attributes, dataRow }) {
          var _a2;
          return /* @__PURE__ */ jsx(
            CurrencyInput,
            {
              decimalScale: 2,
              currencyCode: (_a2 = data == null ? void 0 : data.currency) == null ? void 0 : _a2.code,
              disabled: !(dataRow == null ? void 0 : dataRow.item),
              value: rate,
              onValueChange: (val) => {
                setData2("rate", val);
              },
              ...attributes
            }
          );
        }
      }
    ];
  }, [data]);
  const paymentScheduleColumns = useMemo(() => {
    return [
      {
        name: "payment_term",
        titleTrans: "finances.purchaseInvoice.columns.payment_term",
        show: true,
        cell({ data: paymentTerm, setData: setData2, attributes }) {
          return /* @__PURE__ */ jsx(
            PaymentTermLinkModel,
            {
              placeholder: t(
                "finances.purchaseInvoice.columns.payment_term.placeholder"
              ),
              value: paymentTerm,
              onValueChange: (val) => {
                const due_date = new Date(data == null ? void 0 : data.date);
                switch (val == null ? void 0 : val.due_date_based_on) {
                  case "days_after_invoice_date": {
                    due_date.setDate(
                      due_date.getDate() + ((val == null ? void 0 : val.credit_period) ?? 0)
                    );
                    break;
                  }
                  case "weeks_after_invoice_week": {
                    due_date.setDate(
                      due_date.getDate() + ((val == null ? void 0 : val.credit_period) ?? 0) * 7
                    );
                    break;
                  }
                  case "months_after_invoice_month": {
                    due_date.setMonth(
                      due_date.getMonth() + ((val == null ? void 0 : val.credit_period) ?? 0)
                    );
                    break;
                  }
                }
                setData2({
                  payment_term: val,
                  due_date,
                  description: val == null ? void 0 : val.description,
                  invoice_portion: val == null ? void 0 : val.invoice_portion,
                  discount_type: val == null ? void 0 : val.discount_type,
                  discount: val == null ? void 0 : val.discount,
                  payment_method: val == null ? void 0 : val.payment_method
                });
              },
              ...attributes
            }
          );
        }
      },
      {
        name: "due_date",
        titleTrans: "finances.purchaseInvoice.columns.due_date",
        required: true,
        cell({ data: data2, setData: setData2, attributes }) {
          return /* @__PURE__ */ jsx(
            DatetimePicker,
            {
              type: "datetime",
              value: data2,
              onValueChange: (val) => setData2("due_date", val),
              ...attributes
            }
          );
        }
      },
      {
        name: "description",
        titleTrans: "finances.purchaseInvoice.columns.description",
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
        name: "invoice_portion",
        titleTrans: "finances.purchaseInvoice.columns.invoice_portion",
        required: true,
        width: 1,
        cell({ data: data2, setData: setData2, attributes }) {
          return /* @__PURE__ */ jsx(
            CurrencyInput,
            {
              decimalScale: 2,
              suffix: "%",
              value: data2,
              onValueChange: (val) => {
                setData2("invoice_portion", val);
              },
              ...attributes
            }
          );
        }
      },
      {
        name: "payment_amount",
        titleTrans: "finances.purchaseInvoice.columns.payment_amount",
        required: true,
        readOnly: true,
        width: 1,
        cell({ data: payment_amount, setData: setData2, attributes }) {
          var _a2;
          return /* @__PURE__ */ jsx(
            CurrencyInput,
            {
              decimalScale: 2,
              currencyCode: (_a2 = data == null ? void 0 : data.currency) == null ? void 0 : _a2.code,
              value: payment_amount,
              onValueChange: (val) => {
                setData2("payment_amount", val);
              },
              ...attributes
            }
          );
        }
      },
      {
        name: "payment_method",
        titleTrans: "finances.purchaseInvoice.columns.payment_method",
        width: 1,
        cell({ data: data2, setData: setData2, attributes }) {
          return /* @__PURE__ */ jsx(
            PaymentMethodLinkModel,
            {
              value: data2,
              onValueChange: (val) => setData2("payment_method", val),
              placeholder: t(
                "finances.paymentTerm.columns.payment_method.placeholder"
              ),
              ...attributes
            }
          );
        }
      },
      {
        name: "discount_type",
        titleTrans: "finances.purchaseInvoice.columns.discount_type",
        width: 1,
        cell({ data: data2, setData: setData2, attributes }) {
          return /* @__PURE__ */ jsx(
            Select,
            {
              value: data2,
              onValueChange: (val) => setData2("discount_type", val),
              ...attributes,
              placeholder: t(
                "finances.purchaseInvoice.columns.discount_type.placeholder"
              ),
              optionTrans: "finances.purchaseInvoice.columns.discount_type.options",
              options: ["percentage", "amount"]
            }
          );
        }
      },
      {
        name: "discount",
        titleTrans: "finances.purchaseInvoice.columns.discount",
        width: 1,
        cell({ data: discount, dataRow, setData: setData2, attributes }) {
          var _a2;
          return /* @__PURE__ */ jsx(
            CurrencyInput,
            {
              className: "text-left",
              value: discount,
              currencyCode: dataRow.discount_type == "percentage" ? void 0 : (_a2 = data == null ? void 0 : data.currency) == null ? void 0 : _a2.code,
              onValueChange: (value) => setData2("discount", value),
              decimalsLimit: 2,
              suffix: dataRow.discount_type == "percentage" ? "%" : "",
              min: dataRow.discount_type == "percentage" && 0,
              max: dataRow.discount_type == "percentage" && 100,
              ...attributes
            }
          );
        }
      },
      {
        name: "outstanding_amount",
        titleTrans: "finances.purchaseInvoice.columns.outstanding_amount",
        readOnly: true,
        width: 1,
        cell({ data: data2, setData: setData2, attributes }) {
          var _a2;
          return /* @__PURE__ */ jsx(
            CurrencyInput,
            {
              decimalScale: 2,
              currencyCode: (_a2 = data2 == null ? void 0 : data2.currency) == null ? void 0 : _a2.code,
              value: data2,
              onValueChange: (val) => setData2("outstanding_amount", val),
              ...attributes
            }
          );
        }
      }
    ];
  }, [data]);
  useEffect(() => {
    if (!data.date) {
      setData("date", (/* @__PURE__ */ new Date()).toISOString());
    }
  }, []);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      FormPageContent,
      {
        value: "detail",
        title: t("finances.purchaseInvoice.detail"),
        children: /* @__PURE__ */ jsxs("div", { className: "grid gap-x-4 gap-y-4 md:grid-cols-2", children: [
          /* @__PURE__ */ jsx(
            FormInput,
            {
              name: "date",
              label: t("finances.purchaseInvoice.columns.date"),
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
              label: t("finances.purchaseInvoice.columns.purchase_order"),
              name: "purchase_order",
              children: /* @__PURE__ */ jsx(
                PurchaseOrderLinkModel,
                {
                  disabledAddButton: true,
                  placeholder: t(
                    "finances.purchaseInvoice.columns.purchase_order.placeholder"
                  ),
                  with: [
                    "items",
                    "supplier",
                    "currency",
                    "items.item",
                    "items.tax",
                    "items.unit",
                    "items.targetWarehouse",
                    "paymentSchedules",
                    "paymentSchedules.paymentTerm",
                    "paymentSchedules.paymentMethod"
                  ],
                  value: data.purchase_order,
                  onValueChange: (val) => {
                    setData((prev) => {
                      var _a2;
                      return {
                        ...prev,
                        purchase_order: val,
                        supplier: val == null ? void 0 : val.supplier,
                        currency: val == null ? void 0 : val.currency,
                        items: (_a2 = val == null ? void 0 : val.items) == null ? void 0 : _a2.map((item) => {
                          return {
                            ...item,
                            id: generateRandom(5),
                            referenceable_type: "App\\Models\\Purchase\\PurchaseOrderItem",
                            referenceable_id: item.id,
                            amount: item.basic_amount + item.tax_amount
                          };
                        }),
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
              label: t("finances.purchaseInvoice.supplier"),
              required: true,
              name: "supplier",
              readOnly: true,
              children: /* @__PURE__ */ jsx(SupplierLinkModel, { with: ["branches"], value: data.supplier })
            }
          ),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              className: "col-start-1",
              label: t("finances.purchaseInvoice.currency"),
              name: "currency",
              readOnly: true,
              children: /* @__PURE__ */ jsx(
                CurrencyLinkModel,
                {
                  placeholder: t("finances.purchaseInvoice.currency.placeholder"),
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
              label: t("finances.purchaseInvoice.exchange_rate"),
              name: "exchange_rate",
              readOnly: true,
              children: /* @__PURE__ */ jsx(
                CurrencyInput,
                {
                  disabled: !(((_a = data == null ? void 0 : data.currency) == null ? void 0 : _a.code) && ((_b = data == null ? void 0 : data.currency) == null ? void 0 : _b.code) !== default_currency_id),
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
        ] })
      }
    ),
    /* @__PURE__ */ jsxs(
      FormPageContent,
      {
        value: "detail",
        title: t("finances.purchaseInvoice.items"),
        children: [
          /* @__PURE__ */ jsx(FormPageContentTitle, { className: "flex items-center justify-between gap-x-4", children: t("finances.purchaseInvoice.items") }),
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
            ((_c = data == null ? void 0 : data.currency) == null ? void 0 : _c.code) && ((_d = data == null ? void 0 : data.currency) == null ? void 0 : _d.code) !== default_currency_id && /* @__PURE__ */ jsx(
              FormInput,
              {
                readOnly: true,
                label: `${t("finances.purchaseInvoice.columns.basic_amount")} (${default_currency_id.toUpperCase()})`,
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
                label: `${t("finances.purchaseInvoice.columns.basic_amount")} (${(((_e = data == null ? void 0 : data.currency) == null ? void 0 : _e.code) ?? default_currency_id).toUpperCase()})`,
                className: "col-start-2",
                children: /* @__PURE__ */ jsx(
                  CurrencyInput,
                  {
                    decimalScale: 2,
                    className: "text-right",
                    value: basic_amount,
                    currencyCode: ((_f = data == null ? void 0 : data.currency) == null ? void 0 : _f.code) ?? "default"
                  }
                )
              }
            ),
            ((_g = data == null ? void 0 : data.currency) == null ? void 0 : _g.code) && ((_h = data == null ? void 0 : data.currency) == null ? void 0 : _h.code) !== default_currency_id && /* @__PURE__ */ jsx(
              FormInput,
              {
                readOnly: true,
                label: `${t("finances.purchaseInvoice.columns.tax_amount")} (${default_currency_id.toUpperCase()})`,
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
                label: `${t("finances.purchaseInvoice.columns.tax_amount")} (${(((_i = data == null ? void 0 : data.currency) == null ? void 0 : _i.code) ?? default_currency_id).toUpperCase()})`,
                className: "col-start-2",
                children: /* @__PURE__ */ jsx(
                  CurrencyInput,
                  {
                    decimalScale: 2,
                    className: "text-right",
                    value: tax_amount,
                    currencyCode: ((_j = data == null ? void 0 : data.currency) == null ? void 0 : _j.code) ?? "default"
                  }
                )
              }
            ),
            ((_k = data == null ? void 0 : data.currency) == null ? void 0 : _k.code) && ((_l = data == null ? void 0 : data.currency) == null ? void 0 : _l.code) !== default_currency_id && /* @__PURE__ */ jsx(
              FormInput,
              {
                readOnly: true,
                label: `${t("finances.purchaseInvoice.columns.total")} (${default_currency_id.toUpperCase()})`,
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
                label: `${t("finances.purchaseInvoice.columns.total")} (${(((_m = data == null ? void 0 : data.currency) == null ? void 0 : _m.code) ?? default_currency_id).toUpperCase()})`,
                className: "col-start-2",
                children: /* @__PURE__ */ jsx(
                  CurrencyInput,
                  {
                    className: "text-right",
                    decimalScale: 2,
                    value: amount,
                    currencyCode: ((_n = data == null ? void 0 : data.currency) == null ? void 0 : _n.code) ?? "default"
                  }
                )
              }
            )
          ] })
        ]
      }
    ),
    /* @__PURE__ */ jsx(
      FormPageContent,
      {
        value: "detail",
        title: t("finances.purchaseInvoice.columns.additional_discount"),
        collapsible: true,
        defaultOpen: true,
        children: /* @__PURE__ */ jsxs("div", { className: "grid gap-x-4 gap-y-4 md:grid-cols-2", children: [
          /* @__PURE__ */ jsx(FormInput, { label: t("finances.purchaseInvoice.columns.discount_on"), children: /* @__PURE__ */ jsx(
            Select,
            {
              value: data.discount_on,
              onValueChange: (val) => setData("discount_on", val),
              placeholder: t(
                "finances.purchaseInvoice.columns.discount_on.placeholder"
              ),
              optionTrans: "finances.purchaseInvoice.columns.discount_on.options",
              options: ["grand_total", "net_total"]
            }
          ) }),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              disabled: !(data == null ? void 0 : data.discount_on),
              label: `${t("finances.purchaseInvoice.columns.additional_discount_rate")}`,
              children: /* @__PURE__ */ jsx(
                CurrencyInput,
                {
                  className: "text-right",
                  decimalScale: 2,
                  value: data.discount_rate,
                  suffix: "%"
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              disabled: !(data == null ? void 0 : data.discount_on),
              label: `${t("finances.purchaseInvoice.columns.additional_discount_amount")}`,
              className: "col-start-2",
              children: /* @__PURE__ */ jsx(
                CurrencyInput,
                {
                  className: "text-right",
                  decimalScale: 2,
                  value: data.discount_amount,
                  currencyCode: ((_o = data == null ? void 0 : data.currency) == null ? void 0 : _o.code) ?? "default"
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
        title: t("finances.purchaseInvoice.columns.external_note"),
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
      FormPageContent,
      {
        value: "terms",
        title: t("finances.purchaseInvoice.columns.terms"),
        children: /* @__PURE__ */ jsx("div", { className: "px-1 py-1", children: /* @__PURE__ */ jsx(
          FormTable,
          {
            name: "paymentSchedules",
            className: "col-start-1 col-span-2",
            readOnly: disabled,
            columns: paymentScheduleColumns,
            value: (data == null ? void 0 : data.payment_schedules) ?? [],
            onValueChange: (v) => setData("payment_schedules", v),
            mapItem: ({ item }) => {
              const payment_amount = amount * ((item == null ? void 0 : item.invoice_portion) / 100);
              return {
                ...item,
                payment_amount,
                outstanding_amount: payment_amount
              };
            }
          }
        ) })
      }
    )
  ] });
}
export {
  Form as default
};
