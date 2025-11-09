import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import React from "react";
import CurrencyInput from "@/Components/CurrencyInput";
import CurrencyLinkModel from "@/Pages/Core/CurrencyLinkModel";
import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import Select from "@/Components/Select";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";
import AccountLinkModel from "./AccountLinkModel";
import { Input } from "@/Components/ui/input";

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
    "stock_received_but_not_billed",
  ],
  liability: [
    "payable",
    "current_liability",
    "liability",
    "service_received_but_not_billed",
    "tax",
  ],
  equity: ["equity", "temporary"],
  income: [
    "income_account",
    "direct_income",
    "indirect_income",
    "cost_of_goods_sold",
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
    "round_off_for_opening",
  ],
};

export default function Form() {
  const { t } = useLaravelReactI18n();
  const { data, setData, disabled } = useFormPage();
  const { default_currency_id } = usePage().props.preferences;
  console.log(data);
  return (
    <>
      <FormPageContent value="detail" title={t("finances.account.detail")}>
        <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
          <FormInput
            name="parent_account"
            label={t("finances.account.columns.parent_account")}
            required
          >
            <AccountLinkModel
              placeholder={t(
                "finances.account.columns.parent_account.placeholder",
              )}
              value={data.parent_account}
              onValueChange={(val) => {
                setData((prev) => ({
                  ...prev,
                  parent_account: val,
                  root_type: val?.root_type,
                  report_type: val?.report_type,
                }));
              }}
              filters={{
                is_group: true,
                id: { not: data?.id },
                is_disabled: false,
              }}
            />
          </FormInput>
          <div className="flex gap-x-4 item-center">
            <FormCheckbox
              checked={data.is_group}
              onCheckedChange={(val) => setData("is_group", val)}
              className="pt-4"
            >
              {t("finances.account.columns.is_group")}
            </FormCheckbox>
            <FormCheckbox
              checked={data.is_disabled}
              onCheckedChange={(val) => setData("is_disabled", val)}
              className="pt-4"
            >
              {t("finances.account.columns.is_disabled")}
            </FormCheckbox>
          </div>
          <FormInput
            name="account_number"
            label={t("finances.account.columns.account_number")}
            required
          >
            <Input
              className="text-left"
              value={data.account_number}
              onValueChange={(val) => setData("account_number", val)}
            />
          </FormInput>
          <FormInput
            name="account_name"
            label={t("finances.account.columns.account_name")}
            required
          >
            <Input
              value={data?.account_name}
              onValueChange={(val) => setData("account_name", val)}
            />
          </FormInput>

          <FormInput
            name="root_type"
            label={t("finances.account.columns.root_type")}
            readOnly
          >
            <Input
              value={
                data?.root_type
                  ? t(
                      `finances.account.columns.root_type.options.${data.root_type}`,
                    )
                  : ""
              }
            />
          </FormInput>
          <FormInput
            name="report_type"
            label={t("finances.account.columns.report_type")}
            readOnly
            required
          >
            <Input
              value={
                data?.report_type
                  ? t(
                      `finances.account.columns.report_type.options.${data.report_type}`,
                    )
                  : ""
              }
            />
          </FormInput>

          <FormInput
            name="account_type"
            label={t("finances.account.columns.account_type")}
            disabled={data.is_group}
          >
            <Select
              placeholder={t(
                "finances.account.columns.account_type.placeholder",
              )}
              optionTrans="finances.account.columns.account_type.options"
              options={accountTypes[data.root_type] ?? []}
              value={data.account_type}
              onValueChange={(val) => {
                setData("account_type", val);
              }}
            />
          </FormInput>

          <FormInput
            name="balance_type"
            label={t("finances.account.columns.balance_type")}
          >
            <Select
              value={data.balance_type}
              onValueChange={(val) => setData("balance_type", val)}
              optionTrans="finances.account.columns.balance_type.options"
              options={["debit", "credit"]}
            />
          </FormInput>
          {/* {!data.is_group && (
            <FormInput
              name="currency"
              className="col-start-1"
              label={t("finances.account.columns.currency")}
            >
              <CurrencyLinkModel
                placeholder={t("finances.account.columns.currency.placeholder")}
                value={data.currency}
                onValueChange={(val) => {
                  setData("currency", val);
                }}
              />
            </FormInput>
          )} */}
          {data.account_type == "tax" && (
            <FormInput
              name="tax_rate"
              label={t("finances.account.columns.tax_rate")}
            >
              <CurrencyInput
                value={data.tax_rate}
                decimalScale={2}
                suffix="%"
                onValueChange={(val) => {
                  setData("tax_rate", val);
                }}
              />
            </FormInput>
          )}
        </div>
      </FormPageContent>
    </>
  );
}
