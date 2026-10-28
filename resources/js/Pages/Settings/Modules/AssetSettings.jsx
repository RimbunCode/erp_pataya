import React from "react";
import FormInput from "@/Components/FormInput";
import NumberInput from "@/Components/NumberInput";
import Select from "@/Components/Select";
import ModuleSettingsPage from "./ModuleSettingsPage";
import { useLaravelReactI18n } from "laravel-react-i18n";

// Kunci yang dikenali DepreciationMethodFactory; sama dengan opsi pada form Aset.
const DEPRECIATION_METHODS = [
  "straight_line",
  "double_declining_balance",
  "written_down_value",
  "manual",
];

export default function AssetSettings({ setting = {}, canWrite = true }) {
  const { t } = useLaravelReactI18n();
  const tabs = [
    {
      value: "default",
      title: "asset.setting.default.title",
      label: t("asset.setting.default.title"),
    },
  ];

  return (
    <ModuleSettingsPage
      name="asset"
      title={t("asset.setting.title")}
      setting={setting}
      canWrite={canWrite}
      tabs={tabs}
    >
      {({ data, setData, disabled }) => (
        <div
          className="grid max-w-xl gap-4"
          data-testid="asset-settings-defaults"
        >
          <p className="text-sm text-muted-foreground">
            {t("asset.setting.default_help")}
          </p>
          <FormInput
            name="default_depreciation_method"
            label={t("asset.setting.default_depreciation_method")}
          >
            <Select
              disabled={disabled}
              value={data.default_depreciation_method ?? null}
              onValueChange={(value) =>
                setData("default_depreciation_method", value || null)
              }
              options={DEPRECIATION_METHODS}
              optionTrans="asset.asset.columns.depreciation_method.options"
            />
          </FormInput>
          {data.default_depreciation_method &&
            !DEPRECIATION_METHODS.includes(
              data.default_depreciation_method,
            ) && (
              <p
                role="alert"
                className="text-sm text-amber-700 dark:text-amber-300"
              >
                {t("asset.setting.option_unavailable")}
              </p>
            )}
          <FormInput
            name="default_frequency_of_depreciation"
            label={t("asset.setting.default_frequency_of_depreciation")}
          >
            <NumberInput
              disabled={disabled}
              value={data.default_frequency_of_depreciation ?? ""}
              decimalScale={0}
              min={1}
              className="text-left"
              onValueChange={(value) =>
                setData("default_frequency_of_depreciation", value)
              }
            />
          </FormInput>
          <FormInput
            name="default_total_number_of_depreciations"
            label={t("asset.setting.default_total_number_of_depreciations")}
          >
            <NumberInput
              disabled={disabled}
              value={data.default_total_number_of_depreciations ?? ""}
              decimalScale={0}
              min={1}
              className="text-left"
              onValueChange={(value) =>
                setData("default_total_number_of_depreciations", value)
              }
            />
          </FormInput>
        </div>
      )}
    </ModuleSettingsPage>
  );
}
