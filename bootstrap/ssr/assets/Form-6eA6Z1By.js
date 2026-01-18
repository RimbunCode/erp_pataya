import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { u as useFormPage, T as Textarea, g as FormPageContent, a as FormInput, F as FormCheckbox } from "./checkbox-C_BEU5E4.js";
import { useMemo, useEffect } from "react";
import BranchLinkModel from "./BranchLinkModel-C7QCrxBS.js";
import { C as CurrencyInput } from "./CurrencyInput-DtXsGVaN.js";
import CustomerLinkModel from "./CustomerLinkModel-CDws3QaJ.js";
import { D as DatetimePicker } from "./DatetimePicker-C3h7-5Qi.js";
import { F as FormTable } from "./FormTable-8UNeAa3g.js";
import ItemForm from "./ItemForm-6udTT4rB.js";
import ItemVariantLinkModel from "./ItemVariantLinkModel-bx0YsOm5.js";
import UnitLinkModel from "./UnitLinkModel-2m6CkvAO.js";
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
function Form() {
  var _a, _b;
  const { t } = useLaravelReactI18n();
  const { dataBefore, defaultData, data, setData, disabled, form } = useFormPage();
  const itemColumns = useMemo(() => {
    return [
      {
        name: "item",
        titleTrans: "service.workOrder.columns.item",
        required: true,
        width: 3,
        unique: true,
        cell({ data: data2, setData: setData2, attributes }) {
          return /* @__PURE__ */ jsx(
            ItemVariantLinkModel,
            {
              placeholder: t("service.workOrder.columns.item.placeholder"),
              value: data2,
              onValueChange: (val) => {
                setData2({
                  item: val,
                  unit: val == null ? void 0 : val.default_unit,
                  alternative: null
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
      {
        name: "description",
        titleTrans: "service.workOrder.columns.description",
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
        name: "quantity",
        titleTrans: "service.workOrder.columns.quantity",
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
        titleTrans: "service.workOrder.columns.unit",
        required: true,
        cell({ data: data2, setData: setData2, attributes, dataRow }) {
          var _a2, _b2;
          return /* @__PURE__ */ jsx(
            UnitLinkModel,
            {
              disabled: !(dataRow == null ? void 0 : dataRow.item),
              placeholder: t("service.workOrder.columns.unit.placeholder"),
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
        name: "alternative",
        titleTrans: "service.workOrder.columns.alternative",
        width: 3,
        cell({ data: data2, setData: setData2, attributes, dataRow }) {
          var _a2, _b2, _c, _d, _e, _f, _g;
          return /* @__PURE__ */ jsx(
            ItemVariantLinkModel,
            {
              disabled: !(((_a2 = dataRow == null ? void 0 : dataRow.item) == null ? void 0 : _a2.allow_alternative_item) ?? ((_c = (_b2 = dataRow == null ? void 0 : dataRow.item) == null ? void 0 : _b2.item) == null ? void 0 : _c.allow_alternative_item)),
              placeholder: t(
                "service.workOrder.columns.alternative.placeholder"
              ),
              value: data2,
              onValueChange: (val) => {
                setData2("alternative", val);
              },
              disabledAddButton: true,
              ...attributes,
              filters: {
                category: {
                  type: {
                    in: ["service", "stock"]
                  }
                },
                or: {
                  "raw(item_alternatives.item_id)": (_d = dataRow == null ? void 0 : dataRow.item) == null ? void 0 : _d.id,
                  and: {
                    "raw(item_alternatives.alternative_item_id)": (_e = dataRow == null ? void 0 : dataRow.item) == null ? void 0 : _e.id,
                    "raw(item_alternatives.two_way)": true
                  }
                }
              },
              joins: {
                item_alternatives: {
                  on: {
                    or: {
                      "and[0]": {
                        "item_alternatives.item_id": (_f = dataRow == null ? void 0 : dataRow.item) == null ? void 0 : _f.id,
                        "item_alternatives.alternative_item_id": {
                          column: "item_variants.id"
                        }
                      },
                      "and[1]": {
                        "item_alternatives.alternative_item_id": (_g = dataRow == null ? void 0 : dataRow.item) == null ? void 0 : _g.id,
                        "item_alternatives.item_id": {
                          column: "item_variants.id"
                        },
                        "item_alternatives.two_way": true
                      }
                    }
                  }
                }
              }
            }
          );
        }
      }
    ];
  }, []);
  useEffect(() => {
    if (!data.date) {
      const currentDate = /* @__PURE__ */ new Date();
      form.setData({ date: currentDate });
    }
  }, []);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(FormPageContent, { value: "detail", title: t("service.workOrder.detail"), children: /* @__PURE__ */ jsxs("div", { className: "grid gap-x-4 gap-y-4 md:grid-cols-2", children: [
      /* @__PURE__ */ jsx(
        FormInput,
        {
          label: t("service.workOrder.columns.date"),
          required: true,
          name: "date",
          children: /* @__PURE__ */ jsx(
            DatetimePicker,
            {
              type: "datetime",
              value: data.date,
              onValueChange: (val) => {
                console.log(val);
                setData("date", val);
              }
            }
          )
        }
      ),
      /* @__PURE__ */ jsx(
        FormCheckbox,
        {
          checked: data.for_internal,
          onCheckedChange: (val) => setData("for_internal", val),
          className: "pt-4",
          children: t("service.workOrder.columns.for_internal")
        }
      ),
      /* @__PURE__ */ jsx(
        FormInput,
        {
          className: "col-start-1",
          label: t("service.workOrder.columns.customer"),
          required: !data.for_internal,
          name: "customer",
          children: /* @__PURE__ */ jsx(
            CustomerLinkModel,
            {
              disabled: data.for_internal,
              with: ["branches"],
              valueBefore: dataBefore.customer,
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
          label: t(
            data.for_internal ? "service.workOrder.columns.internal_branch" : "service.workOrder.columns.customer_branch"
          ),
          required: true,
          name: "customer_branch",
          children: /* @__PURE__ */ jsx(
            BranchLinkModel,
            {
              disabled: !(data.for_internal || data.customer),
              valueBefore: dataBefore.customer_branch,
              value: data.customer_branch,
              onValueChange: (val) => setData("customer_branch", val),
              disabledNavigation: !data.for_internal,
              filters: {
                branchable_type: data.for_internal ? null : "App\\Models\\Sales\\Customer",
                branchable_id: data.for_internal ? null : ((_a = data.customer) == null ? void 0 : _a.id) ?? null
              },
              defaultValueForm: {
                branchable_type: data.for_internal ? null : "App\\Models\\Sales\\Customer",
                branchable_id: data.for_internal ? null : ((_b = data.customer) == null ? void 0 : _b.id) ?? null
              }
            }
          )
        }
      ),
      /* @__PURE__ */ jsx(
        FormInput,
        {
          className: "col-span-2 col-start-1",
          label: t("service.workOrder.columns.item_service"),
          required: true,
          name: "item_service",
          children: /* @__PURE__ */ jsx(
            ItemVariantLinkModel,
            {
              placeholder: t(
                "service.workOrder.columns.item_service.placeholder"
              ),
              valueBefore: dataBefore.item_service,
              value: data.item_service,
              onValueChange: (val) => {
                setData("item_service", val);
              },
              filters: {
                category: {
                  type: {
                    in: ["vehicle"]
                  }
                }
              },
              with: ["defaultUnit", "category"]
            }
          )
        }
      ),
      (defaultData == null ? void 0 : defaultData.started_at) && /* @__PURE__ */ jsx(
        FormInput,
        {
          disabled: true,
          label: t("service.workOrder.columns.started_at"),
          children: /* @__PURE__ */ jsx(DatetimePicker, { type: "datetime", value: data.started_at })
        }
      ),
      (defaultData == null ? void 0 : defaultData.complated_at) && /* @__PURE__ */ jsx(
        FormInput,
        {
          disabled: true,
          label: t("service.workOrder.columns.complated_at"),
          children: /* @__PURE__ */ jsx(DatetimePicker, { type: "datetime", value: data.complated_at })
        }
      )
    ] }) }),
    /* @__PURE__ */ jsx(FormPageContent, { value: "detail", title: t("service.workOrder.items"), children: /* @__PURE__ */ jsx(
      FormTable,
      {
        readOnly: disabled,
        columns: itemColumns,
        value: (data == null ? void 0 : data.items) ?? [],
        onValueChange: (v) => setData("items", v),
        form: /* @__PURE__ */ jsx(ItemForm, {})
      }
    ) }),
    /* @__PURE__ */ jsx(
      FormPageContent,
      {
        value: "detail",
        title: t("service.workOrder.columns.external_note"),
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
