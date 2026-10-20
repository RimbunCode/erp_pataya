import React from "react";
import FormInput from "@/Components/FormInput";
import NumberInput from "@/Components/NumberInput";
import ModuleSettingsPage from "./ModuleSettingsPage";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function FinanceSettings({ setting = {}, canWrite = true }) {
  const { t } = useLaravelReactI18n();

  const tabs = [
    {
      value: "tax_invoice",
      title: "finances.setting.tax_invoice.title",
      label: t("finances.setting.tax_invoice.title", "Faktur Pajak"),
    },
  ];

  return (
    <ModuleSettingsPage
      name="finance"
      title={t("finances.setting.title", "Finance Settings")}
      setting={setting}
      canWrite={canWrite}
      tabs={tabs}
      readOnlyFields={["tax_invoice_serial_last_used"]}
    >
      {({ data, setData, disabled }) => (
        <div
          className="grid max-w-xl gap-4"
          data-testid="finance-settings-form"
        >
          <FormInput
            name="tax_invoice_serial_range_start"
            label={t(
              "finances.setting.tax_invoice.range_start",
              "Awal Rentang Nomor Seri",
            )}
          >
            <NumberInput
              allowDecimals={false}
              decimalScale={0}
              disabled={disabled}
              value={data.tax_invoice_serial_range_start ?? ""}
              onValueChange={(val) =>
                setData("tax_invoice_serial_range_start", val)
              }
            />
          </FormInput>

          <FormInput
            name="tax_invoice_serial_range_end"
            label={t(
              "finances.setting.tax_invoice.range_end",
              "Akhir Rentang Nomor Seri",
            )}
          >
            <NumberInput
              allowDecimals={false}
              decimalScale={0}
              disabled={disabled}
              value={data.tax_invoice_serial_range_end ?? ""}
              onValueChange={(val) =>
                setData("tax_invoice_serial_range_end", val)
              }
            />
          </FormInput>

          <FormInput
            name="tax_invoice_serial_last_used"
            label={t(
              "finances.setting.tax_invoice.last_used",
              "Nomor Seri Terakhir Digunakan",
            )}
          >
            <NumberInput
              allowDecimals={false}
              decimalScale={0}
              disabled
              value={setting.tax_invoice_serial_last_used ?? ""}
            />
          </FormInput>
        </div>
      )}
    </ModuleSettingsPage>
  );
}
