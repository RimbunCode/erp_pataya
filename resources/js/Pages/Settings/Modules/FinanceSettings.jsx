import React from "react";
import FormInput from "@/Components/FormInput";
import NumberInput from "@/Components/NumberInput";
import DatetimePicker from "@/Components/DatetimePicker";
import { Switch } from "@/Components/ui/switch";
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
    {
      value: "posting",
      title: "finances.setting.posting.title",
      label: t("finances.setting.posting.title", "Posting"),
    },
    {
      value: "fx",
      title: "finances.setting.fx.title",
      label: t("finances.setting.fx.title", "Kurs"),
    },
  ];

  const discountSplitFields = [
    {
      name: "discount_split_from_sales_invoice",
      label: t(
        "finances.setting.posting.discount_split_from_sales_invoice",
        "Diskon Terpisah Sales Invoice Mulai",
      ),
    },
    {
      name: "discount_split_from_purchase_invoice",
      label: t(
        "finances.setting.posting.discount_split_from_purchase_invoice",
        "Diskon Terpisah Purchase Invoice Mulai",
      ),
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
      {({ data, setData, disabled, tab }) =>
        tab === "fx" ? (
          <div
            className="grid max-w-xl gap-4"
            data-testid="finance-fx-settings"
          >
            <FormInput
              name="fx_max_age_days"
              label={t(
                "finances.setting.fx.max_age_days",
                "Umur Maksimum Kurs (hari)",
              )}
            >
              <NumberInput
                allowDecimals={false}
                decimalScale={0}
                disabled={disabled}
                value={data.fx_max_age_days ?? ""}
                onValueChange={(val) => setData("fx_max_age_days", val)}
              />
              <p className="text-sm text-muted-foreground">
                {t(
                  "finances.setting.fx.max_age_days_help",
                  "Bila tidak ada kurs pada tanggal transaksi, dipakai kurs terdekat sebelumnya dalam batas hari ini.",
                )}
              </p>
            </FormInput>
            <FormInput
              name="fx_allow_inverse"
              label={t(
                "finances.setting.fx.allow_inverse",
                "Izinkan Kurs Kebalikan",
              )}
            >
              <Switch
                aria-label={t(
                  "finances.setting.fx.allow_inverse",
                  "Izinkan Kurs Kebalikan",
                )}
                disabled={disabled}
                checked={Boolean(data.fx_allow_inverse)}
                onCheckedChange={(val) => setData("fx_allow_inverse", val)}
              />
              <p className="text-sm text-muted-foreground">
                {t(
                  "finances.setting.fx.allow_inverse_help",
                  "Bila kurs langsung tidak ada, kurs pasangan sebaliknya dipakai dengan pembagian.",
                )}
              </p>
            </FormInput>
          </div>
        ) : tab === "posting" ? (
          <div
            className="grid max-w-xl gap-4"
            data-testid="finance-posting-settings"
          >
            <p className="text-sm text-muted-foreground">
              {t(
                "finances.setting.posting.discount_split_help",
                "Mulai tanggal ini jurnal invoice memisahkan diskon ke akun Diskon (peran discount). Kosongkan untuk menonaktifkan. Jurnal bertanggal sebelum tanggal ini tidak berubah. Peran discount harus sudah dipetakan pada Posting Profile aktif (Purchase Invoice: lewat aturan akun untuk jenis dokumen Purchase Invoice).",
              )}
            </p>
            {discountSplitFields.map((field) => (
              <FormInput key={field.name} name={field.name} label={field.label}>
                <DatetimePicker
                  type="date"
                  disabled={disabled}
                  value={data[field.name] ?? null}
                  onValueChange={(val) => setData(field.name, val ?? null)}
                />
              </FormInput>
            ))}
          </div>
        ) : (
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
        )
      }
    </ModuleSettingsPage>
  );
}
