import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";

import AccountLinkModel from "@/Pages/Finances/Accounts/AccountLinkModel";
import AssetLinkModel from "@/Pages/Asset/Assets/AssetLinkModel";
import DatetimePicker from "@/Components/DatetimePicker";
import FormInput from "@/Components/FormInput";
import NumberInput from "@/Components/NumberInput";
import React from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Form() {
  const { data, setData } = useFormPage();
  const { t } = useLaravelReactI18n();

  return (
    <FormPageContent title={t("asset.valueAdjustment.title")} value="main">
      <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
        <FormInput
          name="asset"
          required={true}
          label={t("asset.valueAdjustment.columns.asset_id")}
        >
          <AssetLinkModel
            value={data?.asset}
            onValueChange={(val) => setData("asset", val)}
          />
        </FormInput>
        <FormInput
          name="date"
          required={true}
          label={t("asset.valueAdjustment.columns.date")}
        >
          <DatetimePicker
            type="date"
            value={data?.date}
            onValueChange={(val) => setData("date", val)}
          />
        </FormInput>
        <FormInput
          name="current_asset_value"
          label={t("asset.valueAdjustment.columns.current_asset_value")}
        >
          <NumberInput
            value={data?.current_asset_value ?? 0}
            decimalScale={2}
            disabled
          />
        </FormInput>
        <FormInput
          name="new_asset_value"
          required={true}
          label={t("asset.valueAdjustment.columns.new_asset_value")}
        >
          <NumberInput
            value={data?.new_asset_value ?? 0}
            decimalScale={2}
            onValueChange={(val) => setData("new_asset_value", val)}
          />
        </FormInput>
        <FormInput
          name="difference_account"
          required={true}
          label={t("asset.valueAdjustment.columns.difference_account_id")}
        >
          <AccountLinkModel
            value={data?.difference_account}
            onValueChange={(val) => setData("difference_account", val)}
          />
        </FormInput>
      </div>
    </FormPageContent>
  );
}
