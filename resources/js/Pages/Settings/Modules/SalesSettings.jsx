import React, { useState } from "react";
import FormInput from "@/Components/FormInput";
import TaxLinkModel from "@/Pages/Finances/Taxes/TaxLinkModel";
import ModuleSettingsPage from "./ModuleSettingsPage";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function SalesSettings({ setting = {}, canWrite = true, defaultTax = null }) {
  const { t } = useLaravelReactI18n();
  const [selectedTax, setSelectedTax] = useState(null);

  const tabs = [
    {
      value: "default",
      title: "sales.setting.default.title",
      label: t("sales.setting.default.title", "Default"),
    },
  ];

  return (
    <ModuleSettingsPage
      name="sales"
      title={t("sales.setting.title", "Sales Settings")}
      setting={setting}
      canWrite={canWrite}
      tabs={tabs}
    >
      {({ data, setData, disabled }) => (
        <div className="grid max-w-xl gap-4" data-testid="sales-settings-form">
          <FormInput
            name="default_tax_id"
            label={t("sales.setting.default_tax", "Default Tax")}
          >
            <TaxLinkModel
              disabled={disabled}
              value={[selectedTax, defaultTax].find((tax) => tax && tax.id === data.default_tax_id) ?? null}
              onValueChange={(tax) => {
                setSelectedTax(tax);
                setData("default_tax_id", tax?.id ?? null);
              }}
            />
          </FormInput>
        </div>
      )}
    </ModuleSettingsPage>
  );
}
