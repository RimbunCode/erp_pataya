import React, { useState } from "react";
import FormInput from "@/Components/FormInput";
import ModuleSettingsPage from "./ModuleSettingsPage";
import NumberInput from "@/Components/NumberInput";
import PaymentTermTemplateLinkModel from "@/Pages/Finances/PaymentTermTemplate/PaymentTermTemplateLinkModel";
import TaxLinkModel from "@/Pages/Finances/Taxes/TaxLinkModel";
import WarehouseLinkModel from "@/Pages/Inventory/Warehouses/WarehouseLinkModel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/Components/ui/select";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function PurchaseSettings({
  setting = {},
  canWrite = true,
  defaultTax = null,
  defaultTargetWarehouse = null,
  defaultPaymentTermTemplate = null,
}) {
  const { t } = useLaravelReactI18n();
  const [selectedTax, setSelectedTax] = useState(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [selectedPaymentTermTemplate, setSelectedPaymentTermTemplate] = useState(null);
  const tabs = [
    { value: "default", title: "purchase.setting.default.title", label: t("purchase.setting.default.title") },
    { value: "transaction", title: "purchase.setting.transaction.title", label: t("purchase.setting.transaction.title") },
  ];

  return (
    <ModuleSettingsPage name="purchase" title={t("purchase.setting.title")} setting={setting} canWrite={canWrite} tabs={tabs}>
      {({ data, setData, disabled, tab }) => (
        tab === "default" ? (
          <div className="grid max-w-xl gap-4" data-testid="purchase-settings-defaults">
            <FormInput name="default_tax_id" label={t("purchase.setting.default_tax")}>
              <TaxLinkModel disabled={disabled} value={[selectedTax, defaultTax].find((tax) => tax?.id === data.default_tax_id) ?? null} onValueChange={(tax) => { setSelectedTax(tax); setData("default_tax_id", tax?.id ?? null); }} />
            </FormInput>
            {data.default_tax_id && !defaultTax && <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">{t("purchase.setting.reference_unavailable")}</p>}
            <FormInput name="default_target_warehouse_id" label={t("purchase.setting.default_target_warehouse")}>
              <WarehouseLinkModel disabled={disabled} value={[selectedWarehouse, defaultTargetWarehouse].find((warehouse) => warehouse?.id === data.default_target_warehouse_id) ?? null} onValueChange={(warehouse) => { setSelectedWarehouse(warehouse); setData("default_target_warehouse_id", warehouse?.id ?? null); }} />
            </FormInput>
            {data.default_target_warehouse_id && !defaultTargetWarehouse && <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">{t("purchase.setting.reference_unavailable")}</p>}
            <FormInput name="default_payment_term_template_id" label={t("purchase.setting.default_payment_term_template")}>
              <PaymentTermTemplateLinkModel disabled={disabled} value={[selectedPaymentTermTemplate, defaultPaymentTermTemplate].find((template) => template?.id === data.default_payment_term_template_id) ?? null} onValueChange={(template) => { setSelectedPaymentTermTemplate(template); setData("default_payment_term_template_id", template?.id ?? null); }} />
            </FormInput>
            {data.default_payment_term_template_id && !defaultPaymentTermTemplate && <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">{t("purchase.setting.reference_unavailable")}</p>}
          </div>
        ) : (
          <div className="grid max-w-xl gap-4" data-testid="purchase-settings-transactions">
            <FormInput name="over_receipt_tolerance_percent" label={t("purchase.setting.over_receipt_tolerance_percent")}>
              <NumberInput disabled={disabled} value={data.over_receipt_tolerance_percent ?? ""} decimalScale={2} suffix="%" min={0} max={100} onValueChange={(value) => setData("over_receipt_tolerance_percent", value)} />
            </FormInput>
            <p className="-mt-3 text-sm text-muted-foreground">{t("purchase.setting.over_receipt_tolerance_help")}</p>
            <FormInput name="over_billing_tolerance_percent" label={t("purchase.setting.over_billing_tolerance_percent")}>
              <NumberInput disabled={disabled} value={data.over_billing_tolerance_percent ?? ""} decimalScale={2} suffix="%" min={0} max={100} onValueChange={(value) => setData("over_billing_tolerance_percent", value)} />
            </FormInput>
            <p className="-mt-3 text-sm text-muted-foreground">{t("purchase.setting.over_billing_tolerance_help")}</p>
            <FormInput name="rate_change_action" label={t("purchase.setting.rate_change_action")}>
              <Select disabled={disabled} value={data.rate_change_action ?? "none"} onValueChange={(value) => setData("rate_change_action", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["none", "warn", "stop"].map((action) => <SelectItem key={action} value={action}>{t(`purchase.setting.actions.${action}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormInput>
            <p className="-mt-3 text-sm text-muted-foreground">{t("purchase.setting.rate_change_action_help")}</p>
          </div>
        )
      )}
    </ModuleSettingsPage>
  );
}
