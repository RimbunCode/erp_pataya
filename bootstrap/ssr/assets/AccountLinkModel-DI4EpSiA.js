import { jsx, Fragment, jsxs } from "react/jsx-runtime";
import { u as useFormPage, g as FormPageContent, a as FormInput, F as FormCheckbox, L as LinkModel } from "./checkbox-C_BEU5E4.js";
import { forwardRef } from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { C as CurrencyInput } from "./CurrencyInput-DtXsGVaN.js";
import { I as Input } from "./input-wk3Ou7wI.js";
import { S as Select } from "./Select-DB9toH_t.js";
const accountTypes = {
  asset: [
    "bank",
    "cash",
    "receivable",
    "fixed_asset",
    "accumulated_depreciation",
    "depreciation",
    "current_asset",
    "capital_work_in_progress",
    "stock",
    "stock_adjustment",
    "expenses_included_in_asset_valuation",
    "asset_received_but_not_billed",
    "stock_received_but_not_billed"
  ],
  liability: [
    "payable",
    "current_liability",
    "liability",
    "service_received_but_not_billed",
    "expenses_included_in_valuation",
    "tax"
  ],
  equity: ["equity", "temporary", "stock"],
  income: [
    "income_account",
    "direct_income",
    "indirect_income",
    "cost_of_goods_sold"
  ],
  expense: [
    "expense_account",
    "direct_expense",
    "indirect_expense",
    "stock_adjustment",
    "cost_of_goods_sold",
    "chargeable",
    "expenses_included_in_valuation",
    "round_off",
    "round_off_for_opening"
  ]
};
function Form() {
  const { t } = useLaravelReactI18n();
  const { data, setData } = useFormPage();
  return /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsx(FormPageContent, { value: "detail", title: t("finances.account.detail"), children: /* @__PURE__ */ jsxs("div", { className: "grid gap-x-4 gap-y-4 md:grid-cols-2", children: [
    /* @__PURE__ */ jsx(
      FormInput,
      {
        name: "parent_account",
        label: t("finances.account.columns.parent_account"),
        required: true,
        readOnly: data == null ? void 0 : data.have_transactions,
        children: /* @__PURE__ */ jsx(
          AccountLinkModel,
          {
            placeholder: t(
              "finances.account.columns.parent_account.placeholder"
            ),
            value: data.parent_account,
            disabledAddButton: true,
            onValueChange: (val) => {
              setData((prev) => ({
                ...prev,
                parent_account: val,
                root_type: val == null ? void 0 : val.root_type,
                report_type: val == null ? void 0 : val.report_type,
                balance_type: val == null ? void 0 : val.balance_type
              }));
            },
            filters: {
              is_group: true,
              id: { not: data == null ? void 0 : data.id }
            }
          }
        )
      }
    ),
    /* @__PURE__ */ jsxs("div", { className: "flex gap-x-4 item-center", children: [
      /* @__PURE__ */ jsx(
        FormCheckbox,
        {
          checked: data.is_group,
          onCheckedChange: (val) => setData("is_group", val),
          className: "pt-4",
          disabled: data == null ? void 0 : data.have_transactions,
          children: t("finances.account.columns.is_group")
        }
      ),
      /* @__PURE__ */ jsx(
        FormCheckbox,
        {
          checked: data.is_disabled,
          onCheckedChange: (val) => setData("is_disabled", val),
          className: "pt-4",
          children: t("finances.account.columns.is_disabled")
        }
      )
    ] }),
    /* @__PURE__ */ jsx(
      FormInput,
      {
        name: "account_number",
        label: t("finances.account.columns.account_number"),
        required: true,
        children: /* @__PURE__ */ jsx(
          Input,
          {
            className: "text-left",
            value: data.account_number,
            onValueChange: (val) => setData("account_number", val)
          }
        )
      }
    ),
    /* @__PURE__ */ jsx(
      FormInput,
      {
        name: "account_name",
        label: t("finances.account.columns.account_name"),
        required: true,
        children: /* @__PURE__ */ jsx(
          Input,
          {
            value: data == null ? void 0 : data.account_name,
            onValueChange: (val) => setData("account_name", val)
          }
        )
      }
    ),
    /* @__PURE__ */ jsx(
      FormInput,
      {
        name: "root_type",
        label: t("finances.account.columns.root_type"),
        disabled: true,
        children: /* @__PURE__ */ jsx(
          Input,
          {
            value: (data == null ? void 0 : data.root_type) ? t(
              `finances.account.columns.root_type.options.${data.root_type}`
            ) : ""
          }
        )
      }
    ),
    /* @__PURE__ */ jsx(
      FormInput,
      {
        name: "report_type",
        label: t("finances.account.columns.report_type"),
        disabled: true,
        children: /* @__PURE__ */ jsx(
          Input,
          {
            value: (data == null ? void 0 : data.report_type) ? t(
              `finances.account.columns.report_type.options.${data.report_type}`
            ) : ""
          }
        )
      }
    ),
    /* @__PURE__ */ jsx(
      FormInput,
      {
        name: "balance_type",
        label: t("finances.account.columns.balance_type"),
        disabled: true,
        children: /* @__PURE__ */ jsx(
          Select,
          {
            value: data.balance_type,
            onValueChange: (val) => setData("balance_type", val),
            optionTrans: "finances.account.columns.balance_type.options",
            options: ["debit", "credit"]
          }
        )
      }
    ),
    /* @__PURE__ */ jsx(
      FormInput,
      {
        name: "account_type",
        label: t("finances.account.columns.account_type"),
        disabled: data.is_group,
        readOnly: data == null ? void 0 : data.have_transactions,
        children: /* @__PURE__ */ jsx(
          Select,
          {
            placeholder: t(
              "finances.account.columns.account_type.placeholder"
            ),
            optionTrans: "finances.account.columns.account_type.options",
            options: accountTypes[data.root_type] ?? [],
            value: data.account_type,
            onValueChange: (val) => {
              setData("account_type", val);
            }
          }
        )
      }
    ),
    data.account_type == "tax" && /* @__PURE__ */ jsx(
      FormInput,
      {
        name: "tax_rate",
        label: t("finances.account.columns.tax_rate"),
        children: /* @__PURE__ */ jsx(
          CurrencyInput,
          {
            value: data.tax_rate,
            decimalScale: 2,
            suffix: "%",
            onValueChange: (val) => {
              setData("tax_rate", val);
            }
          }
        )
      }
    )
  ] }) }) });
}
const Form$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: Form
}, Symbol.toStringTag, { value: "Module" }));
const AccountLinkModel = forwardRef(function AccountLinkModel2({ value, onValueChange, placeholder, filters, ...props }, ref) {
  const { t } = useLaravelReactI18n();
  return /* @__PURE__ */ jsx(
    LinkModel,
    {
      placeholder,
      value,
      onValueChange,
      model: "App\\Models\\Finances\\Account",
      form: /* @__PURE__ */ jsx(Form, {}),
      filters: {
        is_disabled: false,
        ...filters
      },
      titleDialog: t("finances.account.new"),
      classNameDialog: "max-w-(--breakpoint-lg)!",
      ...props,
      ref
    }
  );
});
const AccountLinkModel$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: AccountLinkModel
}, Symbol.toStringTag, { value: "Module" }));
export {
  AccountLinkModel as A,
  Form as F,
  Form$1 as a,
  AccountLinkModel$1 as b
};
