import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { u as useFormPage, T as Textarea, g as FormPageContent, a as FormInput, L as LinkModel, F as FormCheckbox } from "./checkbox-C_BEU5E4.js";
import { useMemo } from "react";
import BranchLinkModel from "./BranchLinkModel-C7QCrxBS.js";
import { C as CurrencyInput } from "./CurrencyInput-DtXsGVaN.js";
import CustomerLinkModel from "./CustomerLinkModel-CDws3QaJ.js";
import { D as DatetimePicker } from "./DatetimePicker-C3h7-5Qi.js";
import DeliveryNoteLinkModel from "./DeliveryNoteLinkModel-De2hL7n7.js";
import { F as FormTable } from "./FormTable-8UNeAa3g.js";
import ItemVariantLinkModel from "./ItemVariantLinkModel-bx0YsOm5.js";
import PermissionLinkModel from "./PermissionLinkModel-Cy7R6yf4.js";
import UnitLinkModel from "./UnitLinkModel-2m6CkvAO.js";
import WarehouseLinkModel from "./WarehouseLinkModel-CvfxArBc.js";
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
import "./Form-BsjjUTga.js";
import "./UserLinkModel-Dt8-ovm1.js";
function Form() {
  var _a, _b, _c, _d, _e, _f;
  const { t } = useLaravelReactI18n();
  const { data, setData, defaultData } = useFormPage();
  const itemColumns = useMemo(() => {
    return [
      {
        name: "item",
        titleTrans: "inventory.deliveryNote.columns.item",
        required: true,
        width: 2,
        cell({ dataRow, setData: setData2, attributes }) {
          return /* @__PURE__ */ jsx(
            ItemVariantLinkModel,
            {
              placeholder: t("inventory.deliveryNote.columns.item.placeholder"),
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
        titleTrans: "inventory.deliveryNote.columns.description",
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
        titleTrans: "inventory.deliveryNote.columns.source_warehouse",
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
                "inventory.deliveryNote.columns.source_warehouse.placeholder"
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
        titleTrans: "inventory.deliveryNote.columns.quantity",
        required: true,
        type: "number",
        width: 1,
        cell({ dataRow, data: data2, setData: setData2, attributes }) {
          return /* @__PURE__ */ jsx(
            CurrencyInput,
            {
              ...attributes,
              disabled: !(dataRow == null ? void 0 : dataRow.item),
              readOnly: false,
              value: data2,
              onValueChange: (value) => {
                setData2("quantity", value);
              },
              max: dataRow.required_quantity
            }
          );
        }
      },
      {
        name: "unit",
        titleTrans: "inventory.deliveryNote.columns.unit",
        required: true,
        cell({ data: data2, setData: setData2, attributes, dataRow }) {
          var _a2, _b2;
          return /* @__PURE__ */ jsx(
            UnitLinkModel,
            {
              disabled: !(dataRow == null ? void 0 : dataRow.item),
              placeholder: t("inventory.deliveryNote.columns.unit.placeholder"),
              value: data2,
              onValueChange: (val) => setData2("unit", val),
              ...attributes,
              readOnly: false,
              filters: {
                group: (_b2 = (_a2 = dataRow == null ? void 0 : dataRow.item) == null ? void 0 : _a2.default_unit) == null ? void 0 : _b2.group
              }
            }
          );
        }
      }
    ];
  }, [data]);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      FormPageContent,
      {
        value: "detail",
        title: t("inventory.deliveryNote.detail"),
        children: /* @__PURE__ */ jsxs("div", { className: "grid gap-x-4 gap-y-4 md:grid-cols-2", children: [
          /* @__PURE__ */ jsx(
            FormInput,
            {
              name: "date",
              label: t("inventory.deliveryNote.columns.delivery_date"),
              required: true,
              children: /* @__PURE__ */ jsx(
                DatetimePicker,
                {
                  type: "datetime",
                  value: data == null ? void 0 : data.delivery_date,
                  onValueChange: (val) => {
                    setData("delivery_date", val);
                  }
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              label: t("inventory.deliveryNote.columns.reference_to"),
              className: "col-start-1",
              required: true,
              name: "reference_to",
              children: /* @__PURE__ */ jsx(
                PermissionLinkModel,
                {
                  filters: {
                    model: { in: ["App\\Models\\Sales\\SalesOrder"] }
                  },
                  value: data.model,
                  onValueChange: (val) => {
                    setData("model", val);
                  }
                }
              )
            }
          ),
          /* @__PURE__ */ jsx(
            FormInput,
            {
              label: ((_a = data.model) == null ? void 0 : _a.name) ?? "-",
              name: "referenceable",
              required: true,
              disabled: !data.model,
              children: /* @__PURE__ */ jsx(
                LinkModel,
                {
                  model: ((_b = data.model) == null ? void 0 : _b.model) ?? "",
                  disabledAddButton: true,
                  filters: {
                    date: {
                      "<=": (data == null ? void 0 : data.delivery_date) ?? (/* @__PURE__ */ new Date()).toISOString()
                    },
                    status: {
                      jsonContains: (defaultData == null ? void 0 : defaultData.return_against) ? ["delivered", "partially_delivered"] : ["to_deliver", "partially_delivered"]
                    }
                  },
                  with: [
                    "items",
                    "customer",
                    "customer_branch",
                    "items.item",
                    "items.unit",
                    "items.sourceWarehouse"
                  ],
                  value: data.referenceable,
                  onValueChange: (val) => {
                    setData((prev) => {
                      var _a2;
                      return {
                        ...prev,
                        referenceable: val,
                        referenceable_type: (_a2 = data.model) == null ? void 0 : _a2.model,
                        referenceable_id: val == null ? void 0 : val.id,
                        customer: val == null ? void 0 : val.customer,
                        customer_branch: val == null ? void 0 : val.customer_branch,
                        items: val == null ? void 0 : val.items.map((item) => {
                          var _a3;
                          return {
                            ...item,
                            id: generateRandom(8),
                            referenceable_type: ((_a3 = data.model) == null ? void 0 : _a3.model) + "Item",
                            referenceable_id: item.id,
                            quantity: item.undelivered_quantity,
                            required_quantity: item.undelivered_quantity
                          };
                        }),
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
              label: t("inventory.deliveryNote.customer"),
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
              label: t("inventory.deliveryNote.branch"),
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
                    branchable_id: ((_c = data.customer) == null ? void 0 : _c.id) ?? null
                  }
                }
              )
            }
          ),
          (defaultData == null ? void 0 : defaultData.return_against) && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(
              FormCheckbox,
              {
                name: "is_return",
                readOnly: true,
                label: t("inventory.deliveryNote.columns.is_return"),
                checked: !!data.return_against
              }
            ),
            /* @__PURE__ */ jsx(
              FormInput,
              {
                className: "col-start-1",
                label: t("inventory.deliveryNote.columns.return_against"),
                name: "return_against",
                readOnly: true,
                children: /* @__PURE__ */ jsx(DeliveryNoteLinkModel, { value: data.return_against })
              }
            )
          ] })
        ] })
      }
    ),
    /* @__PURE__ */ jsx(FormPageContent, { value: "detail", title: t("inventory.deliveryNote.items"), children: /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-x-4 gap-y-4", children: [
      /* @__PURE__ */ jsx(
        FormInput,
        {
          label: t("inventory.deliveryNote.columns.insert_item"),
          disabled: !data.model,
          children: /* @__PURE__ */ jsx(
            LinkModel,
            {
              model: (((_d = data.model) == null ? void 0 : _d.model) ?? "") + "Item",
              disabledAddButton: true,
              with: ["item", "sourceWarehouse", "unit"],
              filters: {
                sales_order_id: (_e = data == null ? void 0 : data.referenceable) == null ? void 0 : _e.id,
                undelivered_quantity: {
                  ">": 0
                },
                id: {
                  notIn: (_f = data == null ? void 0 : data.items) == null ? void 0 : _f.map((x) => x.referenceable_id)
                }
              },
              value: null,
              onValueChange: (item) => {
                if (!item) return;
                setData((prev) => {
                  var _a2;
                  return {
                    ...prev,
                    items: [
                      ...prev.items,
                      {
                        ...item,
                        id: generateRandom(8),
                        referenceable_type: ((_a2 = data.model) == null ? void 0 : _a2.model) + "Item",
                        referenceable_id: item.id,
                        quantity: item.undelivered_quantity
                      }
                    ]
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
          readOnly: true,
          forceCanDelete: true,
          columns: itemColumns,
          value: (data == null ? void 0 : data.items) ?? [],
          onValueChange: (v) => setData("items", v),
          mapItem: ({ item }) => {
            var _a2;
            const amount = item.quantity * item.price;
            const rateAmount = amount * (((_a2 = item.tax) == null ? void 0 : _a2.rate) ?? 0) / 100;
            return {
              ...item,
              tax_amount: rateAmount,
              basic_amount: amount
            };
          }
        }
      )
    ] }) }),
    /* @__PURE__ */ jsx(
      FormPageContent,
      {
        value: "detail",
        title: t("inventory.deliveryNote.columns.external_note"),
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
