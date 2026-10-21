import React, { useState } from "react";
import FormInput from "@/Components/FormInput";
import ModuleSettingsPage from "./ModuleSettingsPage";
import WarehouseLinkModel from "@/Pages/Inventory/Warehouses/WarehouseLinkModel";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function InventorySettings({ setting = {}, canWrite = true, defaultWarehouse = null }) {
  const { t } = useLaravelReactI18n();
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const tabs = [
    { value: "default", title: "inventory.setting.default.title", label: t("inventory.setting.default.title") },
  ];

  return (
    <ModuleSettingsPage name="inventory" title={t("inventory.setting.title")} setting={setting} canWrite={canWrite} tabs={tabs}>
      {({ data, setData, disabled }) => (
        <div className="grid max-w-xl gap-4" data-testid="inventory-settings-defaults">
          <FormInput name="default_warehouse_id" label={t("inventory.setting.default_warehouse")}>
            <WarehouseLinkModel disabled={disabled} value={[selectedWarehouse, defaultWarehouse].find((warehouse) => warehouse?.id === data.default_warehouse_id) ?? null} onValueChange={(warehouse) => { setSelectedWarehouse(warehouse); setData("default_warehouse_id", warehouse?.id ?? null); }} />
          </FormInput>
          {data.default_warehouse_id && !defaultWarehouse && <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">{t("inventory.setting.reference_unavailable")}</p>}
        </div>
      )}
    </ModuleSettingsPage>
  );
}
