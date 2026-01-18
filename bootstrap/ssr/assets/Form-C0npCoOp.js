import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { u as useFormPage, T as Textarea, g as FormPageContent, a as FormInput, L as LinkModel, F as FormCheckbox } from "./checkbox-C_BEU5E4.js";
import { memo, useMemo, useCallback, useEffect } from "react";
import { S as SelectModel, l as loadFromModel } from "./SelectModel-DOp7Mr8l.js";
import { v as calculateArray, k as generateRandom } from "./utils-ClCZGsDL.js";
import BranchLinkModel from "./BranchLinkModel-C7QCrxBS.js";
import { C as CurrencyInput } from "./CurrencyInput-DtXsGVaN.js";
import CurrencyLinkModel from "./CurrencyLinkModel-u95oYPuj.js";
import CustomerLinkModel from "./CustomerLinkModel-CDws3QaJ.js";
import { D as DatetimePicker } from "./DatetimePicker-C3h7-5Qi.js";
import { F as FormTable } from "./FormTable-8UNeAa3g.js";
import ItemVariantLinkModel from "./ItemVariantLinkModel-bx0YsOm5.js";
import PaymentSchedule from "./PaymentSchedule-Bj4FhgiV.js";
import SalesOrderLinkModel from "./SalesOrderLinkModel-DiJXrAI9.js";
import { S as Select } from "./Select-DB9toH_t.js";
import TaxLinkModel from "./TaxLinkModel-DN-T_7Az.js";
import UnitLinkModel from "./UnitLinkModel-2m6CkvAO.js";
import WarehouseLinkModel from "./WarehouseLinkModel-CvfxArBc.js";
import axios from "axios";
import { b as useDidMountEffect } from "./Link-p0Z4AKax.js";
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
import "@inertiajs/core";
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
import "./Form-B00usptC.js";
import "./CountryLinkModel-sHdBSxco.js";
import "./Form-CMMc7Y6H.js";
import "react-day-picker";
import "@radix-ui/react-scroll-area";
import "./Form-a_UJAbx0.js";
import "./Mention-CB0VqwkR.js";
import "react-mentions";
import "./AttributeLinkModel-ED6Z3erq.js";
import "./Form-Cvx0UpcU.js";
import "./FormBarcodes-BWe8Q1fd.js";
import "./Form-C_ygZCFM.js";
import "./FormDetail-Qe3HBKif.js";
import "./CategoryLinkModel-BHkXUdr5.js";
import "./Form-CjyI6LgW.js";
import "./FormStockLevels-Dn2rbyo9.js";
import "./PaymentTermLinkModel-DeW-CCNL.js";
import "./Form-DVznZ4Aa.js";
import "./PaymentMethodLinkModel-kqgzg9-Y.js";
import "./Form-DLossNJm.js";
import "./Form-DIGwfk9N.js";
import "./Form-BsjjUTga.js";
import "./UserLinkModel-Dt8-ovm1.js";
const Form = memo(function Form2() {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u;
  const { t } = useLaravelReactI18n();
  const { data, setData, defaultData, disabled } = useFormPage();
  const { default_currency_id } = usePage().props.preferences;
  const loadFrom = usePage().props.loadFrom;
  const isLockDoc = useMemo(() => {
    const referenceable_type = (data == null ? void 0 : data.referenceable_type) ?? (defaultData == null ? void 0 : defaultData.referenceable_type);
    if (referenceable_type == "App\\Models\\Service\\WorkOrder") return true;
    return false;
  }, [defaultData, data]);
  const setDiscount = useCallback(
    (key, value) => {
      setData((prev) => {
        let latestDiscountKey = prev.latestDiscountKey ?? "discount_rate";
        let discount_on = prev.discount_on;
        let discount_rate = prev.discount_rate ?? 0;
        let discount_amount = prev.discount_amount ?? 0;
        const net_total2 = calculateArray(prev.items, "basic_amount", "+");
        const tax_amount2 = calculateArray(prev.items, "tax_amount", "+");
        if (key == "discount_on") {
          if (discount_on == value) return prev;
          discount_on = value;
          if (!value)
            return {
              ...prev,
              discount_on,
              discount_rate: void 0,
              discount_amount: void 0,
              latestDiscountKey
            };
        }
        const total = discount_on == "grand_total" ? net_total2 + tax_amount2 : discount_on == "net_total" ? net_total2 : 0;
        if (key == "discount_on") {
          key = latestDiscountKey;
          value = prev[key] ?? 0;
        }
        if (key == "discount_rate") {
          latestDiscountKey = "discount_rate";
          discount_rate = value;
          discount_amount = total * discount_rate / 100;
        }
        if (key == "discount_amount") {
          latestDiscountKey = "discount_amount";
          discount_amount = value;
          discount_rate = discount_amount * 100 / total;
        }
        if (!(prev.discount_on != discount_on || prev.discount_rate != discount_rate || prev.discount_amount != discount_amount)) {
          return prev;
        }
        return {
          ...prev,
          discount_on,
          discount_rate,
          discount_amount,
          latestDiscountKey
        };
      });
    },
    [data]
  );
  const asyncUpdateAdditionalData = useCallback(async (value, idChanges) => {
    return await axios.post(window.route("itemVariants.info"), {
      data: value,
      idChanges
    });
  }, []);
  const net_total = useMemo(() => {
    return calculateArray(data.items, "basic_amount", "+");
  }, [data.items]);
  const tax_amount = useMemo(() => {
    return calculateArray(data.items, "tax_amount", "+");
  }, [data.items]);
  useDidMountEffect(() => {
    const latestKey = data.latestDiscountKey ?? "discount_rate";
    setDiscount(latestKey, data[latestKey] ?? 0);
  }, [net_total, tax_amount]);
  const amount = useMemo(() => {
    return net_total + tax_amount - data.discount_amount;
  }, [net_total, tax_amount, data.discount_amount]);
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
      mergeItems(data2.value, data2.model);
    };
    fetchData().catch(console.error);
  }, []);
  const itemColumns = useMemo(() => {
    return [
      {
        name: "item",
        titleTrans: "sales.salesOrder.columns.item",
        required: true,
        width: 3,
        cell({ dataRow, setData: setData2, attributes }) {
          return /* @__PURE__ */ jsx(
            ItemVariantLinkModel,
            {
              placeholder: t("sales.salesOrder.columns.item.placeholder"),
              value: dataRow.item,
              onValueChange: (val) => {
                setData2({
                  item: val,
                  unit: val == null ? void 0 : val.default_unit,
                  source_warehouse: data.source_warehouse
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
        titleTrans: "sales.salesOrder.columns.description",
        show: false,
        type: "text",
        width: 2,
        cell({ dataRow, data: value, setData: setData2, attributes }) {
          return /* @__PURE__ */ jsx(
            Textarea,
            {
              disabled: !(dataRow == null ? void 0 : dataRow.item),
              rows: 1,
              value: value ?? "",
              onChange: (e) => setData2("description", e.target.value),
              ...attributes,
              readOnly: attributes.readOnly && !(data.submitted_at && isLockDoc)
            }
          );
        }
      },
      {
        name: "source_warehouse",
        titleTrans: "sales.salesOrder.columns.source_warehouse",
        show: true,
        type: "text",
        width: 3,
        required: true,
        cell({ dataRow, data: value, setData: setData2, attributes }) {
          return /* @__PURE__ */ jsx(
            WarehouseLinkModel,
            {
              disabled: !(dataRow == null ? void 0 : dataRow.item),
              placeholder: t(
                "sales.salesOrder.columns.source_warehouse.placeholder"
              ),
              value,
              onValueChange: (val) => setData2("source_warehouse", val),
              ...attributes,
              readOnly: data.submitted_at && !isLockDoc
            }
          );
        }
      },
      {
        name: "available_quantity",
        titleTrans: "sales.salesOrder.columns.available_quantity",
        required: true,
        type: "number",
        width: 1,
        cell({ additionalData, dataRow, attributes }) {
          return /* @__PURE__ */ jsx(
            CurrencyInput,
            {
              ...attributes,
              disabled: !(dataRow == null ? void 0 : dataRow.item),
              readOnly: true,
              value: (additionalData == null ? void 0 : additionalData.available_stock) ?? 0
            }
          );
        }
      },
      {
        name: "quantity",
        titleTrans: "sales.salesOrder.columns.quantity",
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
        titleTrans: "sales.salesOrder.columns.unit",
        width: 2,
        cell({ data: data2, setData: setData2, attributes, dataRow }) {
          var _a2, _b2;
          return /* @__PURE__ */ jsx(
            UnitLinkModel,
            {
              disabled: !(dataRow == null ? void 0 : dataRow.item),
              placeholder: t("sales.salesOrder.columns.unit.placeholder"),
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
        titleTrans: "sales.salesOrder.columns.tax",
        required: true,
        width: 2,
        cell({ data: value, setData: setData2, attributes, dataRow }) {
          return /* @__PURE__ */ jsx(
            TaxLinkModel,
            {
              disabled: !(dataRow == null ? void 0 : dataRow.item),
              placeholder: t("sales.salesOrder.columns.tax.placeholder"),
              value,
              onValueChange: (val) => {
                setData2("tax", val);
              },
              ...attributes,
              readOnly: data.submitted_at && !isLockDoc
            }
          );
        }
      },
      {
        name: "price",
        titleTrans: "sales.salesOrder.columns.price",
        required: true,
        width: 2,
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
              ...attributes,
              readOnly: data.submitted_at && !isLockDoc
            }
          );
        }
      }
    ];
  }, [data, isLockDoc]);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(FormPageContent, { value: "detail", title: t("sales.salesOrder.detail"), children: /* @__PURE__ */ jsxs("div", { className: "grid gap-x-4 gap-y-4 md:grid-cols-2", children: [
      /* @__PURE__ */ jsx(
        FormInput,
        {
          name: "date",
          label: t("sales.salesOrder.columns.date"),
          required: true,
          children: /* @__PURE__ */ jsx(
            DatetimePicker,
            {
              type: "datetime",
              value: data == null ? void 0 : data.date,
              onValueChange: (val) => setData("date", val)
            }
          )
        }
      ),
      data.referenceable && /* @__PURE__ */ jsx(
        FormInput,
        {
          name: "date",
          className: "pointer-events-auto!",
          label: t("sales.salesOrder.columns.reference_to"),
          readOnly: true,
          children: /* @__PURE__ */ jsx(
            LinkModel,
            {
              disabledAddButton: true,
              model: data.referenceable_type,
              value: data.referenceable
            }
          )
        }
      ),
      !isLockDoc && /* @__PURE__ */ jsx(
        FormCheckbox,
        {
          checked: data.is_rent,
          onCheckedChange: (val) => setData("is_rent", val),
          className: "pt-4",
          children: t("sales.salesOrder.for_rent")
        }
      ),
      data.is_rent && /* @__PURE__ */ jsx(
        FormInput,
        {
          required: true,
          label: t("sales.salesOrder.rent_date"),
          name: "rent_date",
          children: /* @__PURE__ */ jsx(
            DatetimePicker,
            {
              type: "daterange",
              value: data.rent_date,
              onValueChange: (range) => setData("rent_date", range)
            }
          )
        }
      ),
      /* @__PURE__ */ jsx(
        FormInput,
        {
          className: "col-start-1",
          label: t("sales.salesOrder.customer"),
          required: true,
          readOnly: isLockDoc,
          name: "customer",
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
          label: t("sales.salesOrder.branch"),
          required: true,
          readOnly: isLockDoc,
          name: "customer_branch",
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
          label: t("sales.salesOrder.currency"),
          name: "currency",
          children: /* @__PURE__ */ jsx(
            CurrencyLinkModel,
            {
              placeholder: t("sales.salesOrder.currency.placeholder"),
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
          label: t("sales.salesOrder.exchange_rate"),
          name: "exchange_rate",
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
      ),
      /* @__PURE__ */ jsx(
        FormInput,
        {
          className: "col-span-2 col-start-1",
          label: t("sales.salesOrder.columns.reference_so"),
          name: "reference_so",
          children: /* @__PURE__ */ jsx(
            SalesOrderLinkModel,
            {
              placeholder: t(
                "sales.salesOrder.columns.reference_so.placeholder"
              ),
              value: data.reference_so,
              onValueChange: (val) => {
                setData("reference_so", val);
              }
            }
          )
        }
      )
    ] }) }),
    /* @__PURE__ */ jsx(
      FormPageContent,
      {
        value: "detail",
        title: t("sales.salesOrder.items"),
        actions: !data.submitted_at && !isLockDoc && /* @__PURE__ */ jsx(
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
                    columns: ["work_order", "item", "quantity", "unit"]
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
        children: /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-x-4 gap-y-4", children: [
          /* @__PURE__ */ jsx(
            FormInput,
            {
              label: t("sales.salesOrder.columns.source_warehouse"),
              name: "source_warehouse",
              children: /* @__PURE__ */ jsx(
                WarehouseLinkModel,
                {
                  placeholder: t(
                    "sales.salesOrder.columns.source_warehouse.placeholder"
                  ),
                  value: data.source_warehouse,
                  onValueChange: (val) => {
                    setData((prev) => {
                      var _a2;
                      if (!prev.items || ((_a2 = prev.items) == null ? void 0 : _a2.length) <= 0)
                        return {
                          ...prev,
                          source_warehouse: val
                        };
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
              name: "items",
              className: "col-start-1 col-span-2",
              readOnly: disabled || isLockDoc,
              columns: itemColumns,
              value: (data == null ? void 0 : data.items) ?? [],
              onValueChange: (v) => {
                setData("items", v);
              },
              asyncUpdateAdditionalData,
              mapItem: ({ item }) => {
                var _a2;
                const amount2 = item.quantity * item.price;
                const rateAmount = amount2 * (((_a2 = item.tax) == null ? void 0 : _a2.rate) ?? 0) / 100;
                return {
                  ...item,
                  tax_amount: rateAmount,
                  basic_amount: amount2
                };
              }
            }
          ),
          ((_d = data == null ? void 0 : data.currency) == null ? void 0 : _d.code) && ((_e = data == null ? void 0 : data.currency) == null ? void 0 : _e.code) !== default_currency_id && /* @__PURE__ */ jsx(
            FormInput,
            {
              readOnly: true,
              label: `${t("sales.salesOrder.columns.net_total")} (${default_currency_id.toUpperCase()})`,
              children: /* @__PURE__ */ jsx(
                CurrencyInput,
                {
                  className: "text-right",
                  value: net_total * ((data == null ? void 0 : data.exchange_rate) ?? 1),
                  currencyCode: "default"
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              readOnly: true,
              label: `${t("sales.salesOrder.columns.net_total")} (${(((_f = data == null ? void 0 : data.currency) == null ? void 0 : _f.code) ?? default_currency_id).toUpperCase()})`,
              className: "col-start-2",
              children: /* @__PURE__ */ jsx(
                CurrencyInput,
                {
                  decimalScale: 2,
                  className: "text-right",
                  value: net_total,
                  currencyCode: ((_g = data == null ? void 0 : data.currency) == null ? void 0 : _g.code) ?? "default"
                }
              )
            }
          ),
          ((_h = data == null ? void 0 : data.currency) == null ? void 0 : _h.code) && ((_i = data == null ? void 0 : data.currency) == null ? void 0 : _i.code) !== default_currency_id && /* @__PURE__ */ jsx(
            FormInput,
            {
              readOnly: true,
              label: `${t("sales.salesOrder.columns.tax_amount")} (${default_currency_id.toUpperCase()})`,
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
              label: `${t("sales.salesOrder.columns.tax_amount")} (${(((_j = data == null ? void 0 : data.currency) == null ? void 0 : _j.code) ?? default_currency_id).toUpperCase()})`,
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
              label: `${t("sales.salesOrder.columns.grand_total")} (${default_currency_id.toUpperCase()})`,
              children: /* @__PURE__ */ jsx(
                CurrencyInput,
                {
                  className: "text-right",
                  value: (net_total + tax_amount) * ((data == null ? void 0 : data.exchange_rate) ?? 1),
                  currencyCode: "default"
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              readOnly: true,
              label: `${t("sales.salesOrder.columns.grand_total")} (${(((_n = data == null ? void 0 : data.currency) == null ? void 0 : _n.code) ?? default_currency_id).toUpperCase()})`,
              className: "col-start-2",
              children: /* @__PURE__ */ jsx(
                CurrencyInput,
                {
                  className: "text-right",
                  decimalScale: 2,
                  value: net_total + tax_amount,
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
        title: t("sales.salesOrder.columns.additional_discount"),
        collapsible: true,
        defaultOpen: true,
        children: /* @__PURE__ */ jsxs("div", { className: "grid gap-x-4 gap-y-4 md:grid-cols-2", children: [
          /* @__PURE__ */ jsx(FormInput, { label: t("sales.salesOrder.columns.discount_on"), children: /* @__PURE__ */ jsx(
            Select,
            {
              value: data.discount_on,
              onValueChange: (val) => setDiscount("discount_on", val),
              placeholder: t(
                "sales.salesOrder.columns.discount_on.placeholder"
              ),
              optionTrans: "sales.salesOrder.columns.discount_on.options",
              options: ["net_total", "grand_total"]
            }
          ) }),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              disabled: !(data == null ? void 0 : data.discount_on),
              label: `${t("sales.salesOrder.columns.additional_discount_rate")}`,
              children: /* @__PURE__ */ jsx(
                CurrencyInput,
                {
                  className: "text-right",
                  value: data.discount_rate,
                  decimalScale: 2,
                  onValueChange: (val) => setDiscount("discount_rate", val),
                  suffix: "%",
                  min: 0,
                  max: 100
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              className: "col-start-2",
              disabled: !(data == null ? void 0 : data.discount_on),
              label: `${t("sales.salesOrder.columns.additional_discount_amount")}`,
              children: /* @__PURE__ */ jsx(
                CurrencyInput,
                {
                  className: "text-right ",
                  value: data.discount_amount,
                  onValueChange: (val) => setDiscount("discount_amount", val),
                  currencyCode: ((_p = data == null ? void 0 : data.currency) == null ? void 0 : _p.code) ?? "default",
                  min: 0,
                  max: data.discount_on == "net_total" ? net_total : net_total + tax_amount
                }
              )
            }
          )
        ] })
      }
    ),
    data.discount_on && /* @__PURE__ */ jsx(FormPageContent, { value: "detail", children: /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-x-4 gap-y-4 border-t -mt-4 pt-4", children: [
      ((_q = data == null ? void 0 : data.currency) == null ? void 0 : _q.code) && ((_r = data == null ? void 0 : data.currency) == null ? void 0 : _r.code) !== default_currency_id && /* @__PURE__ */ jsx(
        FormInput,
        {
          readOnly: true,
          label: `${t("sales.salesOrder.columns.total")} (${default_currency_id.toUpperCase()})`,
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
          label: `${t("sales.salesOrder.columns.total")} (${(((_s = data == null ? void 0 : data.currency) == null ? void 0 : _s.code) ?? default_currency_id).toUpperCase()})`,
          className: "col-start-2",
          children: /* @__PURE__ */ jsx(
            CurrencyInput,
            {
              className: "text-right",
              decimalScale: 2,
              value: amount,
              currencyCode: ((_t = data == null ? void 0 : data.currency) == null ? void 0 : _t.code) ?? "default"
            }
          )
        }
      )
    ] }) }),
    /* @__PURE__ */ jsx(
      FormPageContent,
      {
        value: "detail",
        title: t("sales.salesOrder.columns.external_note"),
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
        currencyCode: (_u = data == null ? void 0 : data.currency) == null ? void 0 : _u.code
      }
    )
  ] });
});
export {
  Form as default
};
