import React, { useState } from "react";
import FormInput from "@/Components/FormInput";
import NumberInput from "@/Components/NumberInput";
import TaxLinkModel from "@/Pages/Finances/Taxes/TaxLinkModel";
import PaymentTermTemplateLinkModel from "@/Pages/Finances/PaymentTermTemplate/PaymentTermTemplateLinkModel";
import WarehouseLinkModel from "@/Pages/Inventory/Warehouses/WarehouseLinkModel";
import ModuleSettingsPage from "./ModuleSettingsPage";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/Components/ui/select";

export default function SalesSettings({ setting = {}, canWrite = true, defaultTax = null, defaultSourceWarehouse = null, defaultPaymentTermTemplate = null }) {
  const { t } = useLaravelReactI18n();
  const [selectedTax, setSelectedTax] = useState(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [selectedPaymentTermTemplate, setSelectedPaymentTermTemplate] = useState(null);

  const tabs = [
    {
      value: "default",
      title: "sales.setting.default.title",
      label: t("sales.setting.default.title", "Default"),
    },
    {
      value: "transaction",
      title: "sales.setting.transaction.title",
      label: t("sales.setting.transaction.title", "Transactions"),
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
      {({ data, setData, disabled, tab }) => {
        const hasDefaultTax = [selectedTax, defaultTax].some((tax) => tax?.id === data.default_tax_id);
        const hasDefaultSourceWarehouse = [selectedWarehouse, defaultSourceWarehouse].some((warehouse) => warehouse?.id === data.default_source_warehouse_id);
        const hasDefaultPaymentTermTemplate = [selectedPaymentTermTemplate, defaultPaymentTermTemplate].some((template) => template?.id === data.default_payment_term_template_id);

        return tab === "default" ? (
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
          {data.default_tax_id && !hasDefaultTax && <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">{t("sales.setting.reference_unavailable")}</p>}
          <FormInput name="default_source_warehouse_id" label={t("sales.setting.default_source_warehouse")}>
            <WarehouseLinkModel disabled={disabled} value={[selectedWarehouse, defaultSourceWarehouse].find((warehouse) => warehouse?.id === data.default_source_warehouse_id) ?? null} onValueChange={(warehouse) => { setSelectedWarehouse(warehouse); setData("default_source_warehouse_id", warehouse?.id ?? null); }} />
          </FormInput>
          {data.default_source_warehouse_id && !hasDefaultSourceWarehouse && <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">{t("sales.setting.reference_unavailable")}</p>}
          <FormInput name="default_payment_term_template_id" label={t("sales.setting.default_payment_term_template")}>
            <PaymentTermTemplateLinkModel disabled={disabled} value={[selectedPaymentTermTemplate, defaultPaymentTermTemplate].find((template) => template?.id === data.default_payment_term_template_id) ?? null} onValueChange={(template) => { setSelectedPaymentTermTemplate(template); setData("default_payment_term_template_id", template?.id ?? null); }} />
          </FormInput>
          {data.default_payment_term_template_id && !hasDefaultPaymentTermTemplate && <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">{t("sales.setting.reference_unavailable")}</p>}
        </div>
      ) : (
        <div className="grid max-w-xl gap-4" data-testid="sales-settings-transactions">
          <FormInput name="over_delivery_tolerance_percent" label={t("sales.setting.over_delivery_tolerance_percent")}>
            <NumberInput disabled={disabled} value={data.over_delivery_tolerance_percent ?? ""} decimalScale={2} suffix="%" min={0} max={100} onValueChange={(value) => setData("over_delivery_tolerance_percent", value)} />
          </FormInput>
          <p className="-mt-3 text-sm text-muted-foreground">{t("sales.setting.over_delivery_tolerance_help")}</p>
          <FormInput name="over_billing_tolerance_percent" label={t("sales.setting.over_billing_tolerance_percent")}>
            <NumberInput disabled={disabled} value={data.over_billing_tolerance_percent ?? ""} decimalScale={2} suffix="%" min={0} max={100} onValueChange={(value) => setData("over_billing_tolerance_percent", value)} />
          </FormInput>
          <p className="-mt-3 text-sm text-muted-foreground">{t("sales.setting.over_billing_tolerance_help")}</p>
          <FormInput name="rate_change_action" label={t("sales.setting.rate_change_action")}>
            <Select disabled={disabled} value={data.rate_change_action ?? "none"} onValueChange={(value) => setData("rate_change_action", value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["none", "warn", "stop"].map((action) => <SelectItem key={action} value={action}>{t(`sales.setting.actions.${action}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormInput>
          <p className="-mt-3 text-sm text-muted-foreground">{t("sales.setting.rate_change_action_help")}</p>
          <FormInput name="below_cost_action" label={t("sales.setting.below_cost_action")}>
            <Select disabled={disabled} value={data.below_cost_action ?? "none"} onValueChange={(value) => setData("below_cost_action", value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["none", "warn", "stop"].map((action) => <SelectItem key={action} value={action}>{t(`sales.setting.actions.${action}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormInput>
          <p className="-mt-3 text-sm text-muted-foreground">{t("sales.setting.below_cost_action_help")}</p>
        </div>
        );
      }}
    </ModuleSettingsPage>
  );
}
