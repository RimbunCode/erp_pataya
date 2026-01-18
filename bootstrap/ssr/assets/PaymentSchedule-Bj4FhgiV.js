import { jsx } from "react/jsx-runtime";
import { F as FormTable } from "./FormTable-8UNeAa3g.js";
import { T as Textarea, g as FormPageContent } from "./checkbox-C_BEU5E4.js";
import { useMemo } from "react";
import PaymentTermLinkModel from "./PaymentTermLinkModel-DeW-CCNL.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { D as DatetimePicker } from "./DatetimePicker-C3h7-5Qi.js";
import { C as CurrencyInput } from "./CurrencyInput-DtXsGVaN.js";
import PaymentMethodLinkModel from "./PaymentMethodLinkModel-kqgzg9-Y.js";
import { S as Select } from "./Select-DB9toH_t.js";
import "./MasterLayout-CRsmljQs.js";
import "@radix-ui/react-alert-dialog";
import "./button-Us2TB7GG.js";
import "lucide-react";
import "radix-ui";
import "./utils-ClCZGsDL.js";
import "date-fns/locale";
import "lodash";
import "buffer";
import "clsx";
import "tailwind-merge";
import "class-variance-authority";
import "./use-mobile-BsFue-bT.js";
import "@inertiajs/react";
import "sonner";
import "zustand";
import "./tooltip-Df8khweJ.js";
import "@radix-ui/react-tooltip";
import "./Link-p0Z4AKax.js";
import "@inertiajs/core";
import "./command-BSnyCa9u.js";
import "@radix-ui/react-dialog";
import "cmdk";
import "@dnd-kit/core";
import "@dnd-kit/sortable";
import "@dnd-kit/utilities";
import "./input-wk3Ou7wI.js";
import "./label-DiFvdPYz.js";
import "@radix-ui/react-label";
import "./useDynamicRefs-DuDlSZ7v.js";
import "@radix-ui/react-checkbox";
import "./avatar-_KK8H2Pc.js";
import "@radix-ui/react-avatar";
import "./AppLayout-Drqdr6Z-.js";
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
import "./Form-DVznZ4Aa.js";
import "./select-XM4G_Lvw.js";
import "@radix-ui/react-select";
import "react-day-picker";
import "@radix-ui/react-scroll-area";
import "./Form-DLossNJm.js";
function PaymentSchedule({
  date,
  value,
  onValueChange,
  readOnly,
  mapItem,
  currencyCode
}) {
  const { t } = useLaravelReactI18n();
  const paymentScheduleColumns = useMemo(() => {
    return [
      {
        name: "payment_term",
        titleTrans: "finances.paymentSchedule.columns.payment_term",
        show: true,
        cell({ data: paymentTerm, setData, attributes }) {
          return /* @__PURE__ */ jsx(
            PaymentTermLinkModel,
            {
              placeholder: t(
                "finances.paymentSchedule.columns.payment_term.placeholder"
              ),
              value: paymentTerm,
              onValueChange: (val) => {
                const due_date = new Date(date);
                console.log(due_date, date);
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
                console.log(due_date);
                setData({
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
        titleTrans: "finances.paymentSchedule.columns.due_date",
        required: true,
        cell({ data, setData, attributes }) {
          return /* @__PURE__ */ jsx(
            DatetimePicker,
            {
              type: "datetime",
              value: data,
              onValueChange: (val) => setData("due_date", val),
              ...attributes
            }
          );
        }
      },
      {
        name: "description",
        titleTrans: "finances.paymentSchedule.columns.description",
        show: false,
        type: "text",
        width: 2,
        cell({ dataRow, data, setData, attributes }) {
          return /* @__PURE__ */ jsx(
            Textarea,
            {
              disabled: !(dataRow == null ? void 0 : dataRow.item),
              rows: 1,
              value: data ?? "",
              onChange: (e) => setData("description", e.target.value),
              ...attributes
            }
          );
        }
      },
      {
        name: "invoice_portion",
        titleTrans: "finances.paymentSchedule.columns.invoice_portion",
        required: true,
        width: 1,
        cell({ data, setData, attributes }) {
          return /* @__PURE__ */ jsx(
            CurrencyInput,
            {
              decimalScale: 2,
              suffix: "%",
              value: data,
              onValueChange: (val) => {
                setData("invoice_portion", val);
              },
              ...attributes
            }
          );
        }
      },
      {
        name: "payment_amount",
        titleTrans: "finances.paymentSchedule.columns.payment_amount",
        required: true,
        readOnly: true,
        width: 1,
        cell({ data: payment_amount, setData, attributes }) {
          return /* @__PURE__ */ jsx(
            CurrencyInput,
            {
              decimalScale: 2,
              currencyCode,
              value: payment_amount,
              onValueChange: (val) => {
                setData("payment_amount", val);
              },
              ...attributes
            }
          );
        }
      },
      {
        name: "payment_method",
        titleTrans: "finances.paymentSchedule.columns.payment_method",
        width: 1,
        cell({ data, setData, attributes }) {
          return /* @__PURE__ */ jsx(
            PaymentMethodLinkModel,
            {
              value: data,
              onValueChange: (val) => setData("payment_method", val),
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
        titleTrans: "finances.paymentSchedule.columns.discount_type",
        width: 1,
        cell({ data, setData, attributes }) {
          return /* @__PURE__ */ jsx(
            Select,
            {
              value: data,
              onValueChange: (val) => setData("discount_type", val),
              ...attributes,
              placeholder: t(
                "finances.paymentSchedule.columns.discount_type.placeholder"
              ),
              optionTrans: "finances.paymentSchedule.columns.discount_type.options",
              options: ["percentage", "amount"]
            }
          );
        }
      },
      {
        name: "discount",
        titleTrans: "finances.paymentSchedule.columns.discount",
        width: 1,
        cell({ data: discount, dataRow, setData, attributes }) {
          return /* @__PURE__ */ jsx(
            CurrencyInput,
            {
              className: "text-left",
              value: discount,
              currencyCode: dataRow.discount_type == "percentage" ? void 0 : currencyCode,
              onValueChange: (value2) => setData("discount", value2),
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
        titleTrans: "finances.paymentSchedule.columns.outstanding_amount",
        readOnly: true,
        width: 1,
        cell({ data, setData, attributes }) {
          return /* @__PURE__ */ jsx(
            CurrencyInput,
            {
              decimalScale: 2,
              currencyCode,
              value: data,
              onValueChange: (val) => setData("outstanding_amount", val),
              ...attributes
            }
          );
        }
      }
    ];
  }, [date, currencyCode]);
  return /* @__PURE__ */ jsx(
    FormPageContent,
    {
      value: "terms",
      title: t("finances.paymentSchedule.columns.terms"),
      children: /* @__PURE__ */ jsx("div", { className: "px-1 py-1", children: /* @__PURE__ */ jsx(
        FormTable,
        {
          name: "paymentSchedules",
          className: "col-start-1 col-span-2",
          readOnly,
          columns: paymentScheduleColumns,
          value,
          onValueChange,
          mapItem
        }
      ) })
    }
  );
}
export {
  PaymentSchedule as default
};
