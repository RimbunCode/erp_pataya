import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";

import AssetCategoryLinkModel from "@/Pages/Asset/Categories/AssetCategoryLinkModel";
import AssetLocationLinkModel from "@/Pages/Asset/Locations/AssetLocationLinkModel";
import CustomerLinkModel from "@/Pages/Sales/Customers/CustomerLinkModel";
import DatetimePicker from "@/Components/DatetimePicker";
import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import ItemLinkModel from "@/Pages/Inventory/Items/ItemLinkModel";
import { Input } from "@/Components/ui/input";
import NumberInput from "@/Components/NumberInput";
import PurchaseInvoiceItemLinkModel from "@/Pages/Finances/PurchaseInvoice/PurchaseInvoiceItemLinkModel";
import PurchaseReceiptItemLinkModel from "@/Pages/Purchase/PurchaseReceipts/PurchaseReceiptItemLinkModel";
import React, { useEffect, useRef } from "react";
import Select from "@/Components/Select";
import SupplierLinkModel from "@/Pages/Purchase/Suppliers/SupplierLinkModel";
import UserLinkModel from "@/Pages/Users/ManageUsers/UserLinkModel";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Form() {
  const { data, setData, _disabled } = useFormPage();
  const { t } = useLaravelReactI18n();

  // Requirement 2.6/2.8, spec asset-management-purchase-integration-v2:
  // ubah item_id -> reset link Purchase yang sudah tidak match Item baru.
  // Ref, bukan state biasa -- hanya perlu nilai SEBELUM render ini untuk
  // deteksi perubahan, tidak perlu trigger re-render sendiri.
  const prevItemIdRef = useRef(data?.item?.id);
  useEffect(() => {
    const currentItemId = data?.item?.id;
    if (currentItemId === prevItemIdRef.current) return;
    prevItemIdRef.current = currentItemId;

    const receiptItemMatches =
      data?.purchase_receipt_item?.item?.item?.id === currentItemId;
    const invoiceItemMatches =
      data?.purchase_invoice_item?.item?.item?.id === currentItemId;

    if (data?.purchase_receipt_item && !receiptItemMatches) {
      setData((prev) => ({
        ...prev,
        purchase_receipt_item: null,
        purchase_receipt_id: null,
        purchase_receipt_item_id: null,
      }));
    }
    if (data?.purchase_invoice_item && !invoiceItemMatches) {
      setData((prev) => ({
        ...prev,
        purchase_invoice_item: null,
        purchase_invoice_id: null,
        purchase_invoice_item_id: null,
      }));
    }
  }, [data?.item?.id]);

  const itemVariantIds = data?.item?.variants?.map((v) => v.id) ?? [];
  const purchaseLinkFilters = itemVariantIds.length
    ? { item_id: { in: itemVariantIds } }
    : {};

  const handlePurchaseReceiptItemChange = (val) => {
    if (!val) {
      setData((prev) => ({
        ...prev,
        purchase_receipt_item: null,
        purchase_receipt_id: null,
        purchase_receipt_item_id: null,
      }));

      return;
    }

    setData((prev) => ({
      ...prev,
      purchase_receipt_item: val,
      purchase_receipt_id: val.purchase_receipt_id,
      purchase_receipt_item_id: val.id,
      asset_quantity: val.quantity,
      purchase_date: val.purchaseReceipt?.date ?? prev.purchase_date,
      // item_id ikut ter-derive HANYA kalau belum dipilih (Requirement 2.5/3.1).
      ...(!prev.item ? { item: val.item?.item } : {}),
    }));
  };

  const handlePurchaseInvoiceItemChange = (val) => {
    if (!val) {
      setData((prev) => ({
        ...prev,
        purchase_invoice_item: null,
        purchase_invoice_id: null,
        purchase_invoice_item_id: null,
      }));

      return;
    }

    setData((prev) => ({
      ...prev,
      purchase_invoice_item: val,
      purchase_invoice_id: val.purchase_invoice_id,
      purchase_invoice_item_id: val.id,
      net_purchase_amount: val.basic_amount,
      gross_purchase_amount: val.amount,
      // Tanggal Receipt lebih relevan -- hanya pakai tanggal invoice kalau
      // belum ada dari Receipt (Requirement 3.5).
      purchase_date: prev.purchase_receipt_item
        ? prev.purchase_date
        : (val.purchaseInvoice?.date ?? prev.purchase_date),
      ...(!prev.item ? { item: val.item?.item } : {}),
    }));
  };

  return (
    <>
      <FormPageContent
        title={t("asset.asset.sections.identity")}
        value="identity"
      >
        <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
          <FormInput
            name="asset_name"
            required={true}
            label={t("asset.asset.columns.asset_name")}
          >
            <Input
              value={data?.asset_name ?? ""}
              onChange={(e) => setData("asset_name", e.target.value)}
            />
          </FormInput>
          <FormInput
            name="asset_category"
            required={true}
            label={t("asset.asset.columns.asset_category_id")}
          >
            <AssetCategoryLinkModel
              value={data?.asset_category}
              onValueChange={(val) => setData("asset_category", val)}
            />
          </FormInput>
          <FormInput
            name="asset_location"
            required={true}
            label={t("asset.asset.columns.asset_location_id")}
          >
            <AssetLocationLinkModel
              value={data?.asset_location}
              onValueChange={(val) => setData("asset_location", val)}
            />
          </FormInput>
          <FormInput
            name="asset_type"
            label={t("asset.asset.columns.asset_type")}
          >
            <Select
              value={data?.asset_type ?? "existing_asset"}
              onValueChange={(val) => setData("asset_type", val)}
              optionTrans="asset.asset.columns.asset_type.options"
              options={["existing_asset"]}
              disabled
            />
          </FormInput>
          <FormInput name="item" label={t("asset.asset.columns.item_id")}>
            <ItemLinkModel
              value={data?.item}
              onValueChange={(val) => setData("item", val)}
              filters={{ is_fixed_asset: true }}
              with={["variants"]}
            />
          </FormInput>
          <FormInput
            name="purchase_receipt_item"
            label={t("asset.asset.columns.purchase_receipt_item_id")}
          >
            <PurchaseReceiptItemLinkModel
              value={data?.purchase_receipt_item}
              onValueChange={handlePurchaseReceiptItemChange}
              filters={purchaseLinkFilters}
              with={["item.item", "purchaseReceipt"]}
            />
          </FormInput>
          <FormInput
            name="purchase_invoice_item"
            label={t("asset.asset.columns.purchase_invoice_item_id")}
          >
            <PurchaseInvoiceItemLinkModel
              value={data?.purchase_invoice_item}
              onValueChange={handlePurchaseInvoiceItemChange}
              filters={purchaseLinkFilters}
              with={["item.item", "purchaseInvoice"]}
            />
          </FormInput>
          <FormInput
            name="asset_quantity"
            label={t("asset.asset.columns.asset_quantity")}
          >
            <NumberInput
              value={data?.asset_quantity ?? 1}
              decimalScale={0}
              onValueChange={(val) => setData("asset_quantity", val)}
              className="text-left"
              disabled={!!data?.purchase_receipt_item}
            />
          </FormInput>
          <FormInput
            name="custodian"
            label={t("asset.asset.columns.custodian_id")}
          >
            <UserLinkModel
              value={data?.custodian}
              onValueChange={(val) => setData("custodian", val)}
            />
          </FormInput>
          <div className="flex flex-col gap-y-2">
            <FormCheckbox
              checked={data?.is_rentable ?? false}
              onCheckedChange={(val) => setData("is_rentable", val)}
            >
              {t("asset.asset.columns.is_rentable")}
            </FormCheckbox>
            <FormCheckbox
              checked={data?.allow_bulk_quantity ?? false}
              onCheckedChange={(val) => setData("allow_bulk_quantity", val)}
            >
              {t("asset.asset.columns.allow_bulk_quantity")}
            </FormCheckbox>
          </div>
        </div>
      </FormPageContent>

      <FormPageContent
        title={t("asset.asset.sections.ownership")}
        value="ownership"
      >
        <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
          <FormInput
            name="ownership_type"
            label={t("asset.asset.columns.ownership_type")}
          >
            <Select
              value={data?.ownership_type ?? "company"}
              onValueChange={(val) => setData("ownership_type", val)}
              optionTrans="asset.asset.columns.ownership_type.options"
              options={["company", "supplier", "customer"]}
            />
          </FormInput>

          {data?.ownership_type === "supplier" && (
            <FormInput
              name="ownership_supplier"
              required={true}
              label={t("asset.asset.columns.ownership_supplier_id")}
            >
              <SupplierLinkModel
                value={data?.ownership_supplier}
                onValueChange={(val) => setData("ownership_supplier", val)}
              />
            </FormInput>
          )}

          {data?.ownership_type === "customer" && (
            <FormInput
              name="ownership_customer"
              required={true}
              label={t("asset.asset.columns.ownership_customer_id")}
            >
              <CustomerLinkModel
                value={data?.ownership_customer}
                onValueChange={(val) => setData("ownership_customer", val)}
              />
            </FormInput>
          )}
        </div>
      </FormPageContent>

      <FormPageContent
        title={t("asset.asset.sections.purchase")}
        value="purchase"
      >
        <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
          <FormInput
            name="purchase_date"
            label={t("asset.asset.columns.purchase_date")}
          >
            <DatetimePicker
              type="date"
              value={data?.purchase_date}
              onValueChange={(val) => setData("purchase_date", val)}
            />
          </FormInput>
          <FormInput
            name="available_for_use_date"
            label={t("asset.asset.columns.available_for_use_date")}
          >
            <DatetimePicker
              type="date"
              value={data?.available_for_use_date}
              onValueChange={(val) => setData("available_for_use_date", val)}
            />
          </FormInput>
          <FormInput
            name="gross_purchase_amount"
            label={t("asset.asset.columns.gross_purchase_amount")}
          >
            <NumberInput
              value={data?.gross_purchase_amount ?? 0}
              decimalScale={2}
              onValueChange={(val) => setData("gross_purchase_amount", val)}
              className="text-left"
              disabled={!!data?.purchase_invoice_item}
            />
          </FormInput>
          <FormInput
            name="additional_asset_cost"
            label={t("asset.asset.columns.additional_asset_cost")}
          >
            <NumberInput
              value={data?.additional_asset_cost ?? 0}
              decimalScale={2}
              onValueChange={(val) => setData("additional_asset_cost", val)}
              className="text-left"
            />
          </FormInput>
          <FormInput
            name="total_asset_cost"
            label={t("asset.asset.columns.total_asset_cost")}
            disabled
          >
            <Input
              value={
                (data?.gross_purchase_amount ?? 0) +
                (data?.additional_asset_cost ?? 0)
              }
              disabled
            />
          </FormInput>

          <FormCheckbox
            checked={data?.calculate_depreciation ?? false}
            onCheckedChange={(val) => setData("calculate_depreciation", val)}
            className="md:col-span-2"
          >
            {t("asset.asset.columns.calculate_depreciation")}
          </FormCheckbox>

          {data?.calculate_depreciation && (
            <>
              <FormInput
                name="depreciation_method"
                label={t("asset.asset.columns.depreciation_method")}
              >
                <Select
                  value={data?.depreciation_method}
                  onValueChange={(val) => setData("depreciation_method", val)}
                  optionTrans="asset.asset.columns.depreciation_method.options"
                  options={[
                    "straight_line",
                    "double_declining_balance",
                    "written_down_value",
                    "manual",
                  ]}
                />
              </FormInput>
              <FormInput
                name="frequency_of_depreciation"
                label={t("asset.asset.columns.frequency_of_depreciation")}
              >
                <NumberInput
                  value={data?.frequency_of_depreciation}
                  decimalScale={0}
                  onValueChange={(val) =>
                    setData("frequency_of_depreciation", val)
                  }
                  className="text-left"
                />
              </FormInput>
              <FormInput
                name="total_number_of_depreciations"
                label={t("asset.asset.columns.total_number_of_depreciations")}
              >
                <NumberInput
                  value={data?.total_number_of_depreciations}
                  decimalScale={0}
                  onValueChange={(val) =>
                    setData("total_number_of_depreciations", val)
                  }
                  className="text-left"
                />
              </FormInput>
              <FormInput
                name="expected_value_after_useful_life"
                label={t(
                  "asset.asset.columns.expected_value_after_useful_life",
                )}
              >
                <NumberInput
                  value={data?.expected_value_after_useful_life ?? 0}
                  decimalScale={2}
                  onValueChange={(val) =>
                    setData("expected_value_after_useful_life", val)
                  }
                  className="text-left"
                />
              </FormInput>
            </>
          )}
        </div>
      </FormPageContent>

      <FormPageContent
        title={t("asset.asset.sections.insurance")}
        value="insurance"
      >
        <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
          <FormInput
            name="insurance_policy_number"
            label={t("asset.asset.columns.insurance_policy_number")}
          >
            <Input
              value={data?.insurance_policy_number ?? ""}
              onChange={(e) =>
                setData("insurance_policy_number", e.target.value)
              }
            />
          </FormInput>
          <FormInput
            name="insurance_insurer"
            label={t("asset.asset.columns.insurance_insurer")}
          >
            <Input
              value={data?.insurance_insurer ?? ""}
              onChange={(e) => setData("insurance_insurer", e.target.value)}
            />
          </FormInput>
          <FormInput
            name="insurance_insured_value"
            label={t("asset.asset.columns.insurance_insured_value")}
          >
            <NumberInput
              value={data?.insurance_insured_value}
              decimalScale={2}
              onValueChange={(val) => setData("insurance_insured_value", val)}
              className="text-left"
            />
          </FormInput>
          <FormInput
            name="insurance_start_date"
            label={t("asset.asset.columns.insurance_start_date")}
          >
            <DatetimePicker
              type="date"
              value={data?.insurance_start_date}
              onValueChange={(val) => setData("insurance_start_date", val)}
            />
          </FormInput>
          <FormInput
            name="insurance_end_date"
            label={t("asset.asset.columns.insurance_end_date")}
          >
            <DatetimePicker
              type="date"
              value={data?.insurance_end_date}
              onValueChange={(val) => setData("insurance_end_date", val)}
            />
          </FormInput>
          <FormCheckbox
            checked={data?.insurance_comprehensive ?? false}
            onCheckedChange={(val) => setData("insurance_comprehensive", val)}
          >
            {t("asset.asset.columns.insurance_comprehensive")}
          </FormCheckbox>
        </div>
      </FormPageContent>
    </>
  );
}
