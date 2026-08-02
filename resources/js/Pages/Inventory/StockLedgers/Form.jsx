import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";

import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import ItemUnitLinkModel from "@/Pages/Inventory/Items/ItemUnitLinkModel";
import ItemVariantLinkModel from "@/Pages/Inventory/Items/ItemVariantLinkModel";
import LinkModel from "@/Components/LinkModel";
import NumberInput from "@/Components/NumberInput";
import WarehouseLinkModel from "@/Pages/Inventory/Warehouses/WarehouseLinkModel";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Form() {
  const { t } = useLaravelReactI18n();
  const { data } = useFormPage();

  return (
    <FormPageContent value="detail" title={t("inventory.stockLedger.detail")}>
      <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
        <FormInput name="code" label={t("inventory.stockLedger.columns.code")}>
          <Input value={data?.code} readOnly />
        </FormInput>
        <FormInput name="item" label={t("inventory.stockLedger.columns.item")}>
          <ItemVariantLinkModel value={data?.item} readOnly disabledAddButton />
        </FormInput>
        <FormInput name="unit" label={t("inventory.stockLedger.columns.unit")}>
          <ItemUnitLinkModel value={data?.unit} readOnly disabledAddButton />
        </FormInput>
        <FormInput
          name="warehouse"
          label={t("inventory.stockLedger.columns.warehouse")}
        >
          <WarehouseLinkModel
            value={data?.warehouse}
            readOnly
            disabledAddButton
          />
        </FormInput>
        <FormInput
          name="quantity_change"
          label={t("inventory.stockLedger.columns.quantity_change")}
        >
          <NumberInput
            value={data?.quantity_change}
            readOnly
            decimalScale={2}
          />
        </FormInput>
        <FormInput
          name="quantity_after_transaction"
          label={t("inventory.stockLedger.columns.quantity_after_transaction")}
        >
          <NumberInput
            value={data?.quantity_after_transaction}
            readOnly
            decimalScale={2}
          />
        </FormInput>
        <FormInput
          name="valuation_rate"
          label={t("inventory.stockLedger.columns.valuation_rate")}
        >
          <NumberInput value={data?.valuation_rate} readOnly decimalScale={2} />
        </FormInput>
        <FormInput
          name="balance_stock_value"
          label={t("inventory.stockLedger.columns.balance_stock_value")}
        >
          <NumberInput
            value={data?.balance_stock_value}
            readOnly
            decimalScale={2}
          />
        </FormInput>
        <FormInput
          name="change_in_stock_value"
          label={t("inventory.stockLedger.columns.change_in_stock_value")}
        >
          <NumberInput
            value={data?.change_in_stock_value}
            readOnly
            decimalScale={2}
          />
        </FormInput>
        <FormInput
          name="referenceable"
          label={t("inventory.stockLedger.columns.referenceable")}
        >
          <LinkModel
            readOnly
            disabledAddButton
            value={data?.referenceable}
            customNavigation={
              data?.referenceable
                ? (value) =>
                    window.open(
                      route(`${value.route}.show`, value.id),
                      "_blank",
                    )
                : undefined
            }
          />
        </FormInput>
      </div>
    </FormPageContent>
  );
}
