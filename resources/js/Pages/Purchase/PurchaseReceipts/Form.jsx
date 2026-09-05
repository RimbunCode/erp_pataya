import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";

import AssetCompletionRowBadge from "@/Pages/Asset/Assets/AssetCompletionRowBadge";
import NumberInput from "@/Components/NumberInput";
import DatetimePicker from "@/Components/DatetimePicker";
import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import ItemForm from "./ItemForm";
import ItemUnitLinkModel from "@/Pages/Inventory/Items/ItemUnitLinkModel";
import PurchaseOrderItemLinkModel from "../PurchaseOrders/PurchaseOrderItemLinkModel";
import PurchaseOrderLinkModel from "../PurchaseOrders/PurchaseOrderLinkModel";
import PurchaseReceiptLinkModel from "./PurchaseReceiptLinkModel";
import React from "react";
import SupplierLinkModel from "../Suppliers/SupplierLinkModel";
import { Textarea } from "@/Components/ui/textarea";
import { generateRandom } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useMemo } from "react";
import { usePage } from "@inertiajs/react";
import WarehouseLinkModel from "@/Pages/Inventory/Warehouses/WarehouseLinkModel";

function Form() {
  const { t } = useLaravelReactI18n();
  const fixedAssets = usePage().props.fixedAssets;
  const purchaseReceiptId = usePage().props.purchaseReceipt?.id;
  const { data, setData } = useFormPage(
    {
      date: new Date(),
    },
    {
      trackDefaultValue: false,
      notUseWhenCreate: true,
    },
  );

  const itemColumns = useMemo(() => {
    return [
      {
        name: "purchase_order_item",
        titleTrans: "purchase.purchaseReceipt.columns.item",
        required: true,
        width: 3,
        cell({ dataRow, setData, attributes }) {
          return (
            <div className="flex items-center w-full">
              <PurchaseOrderItemLinkModel
                placeholder={t(
                  "purchase.purchaseReceipt.columns.item.placeholder",
                )}
                value={dataRow.purchase_order_item ?? null}
                disabled={!data.purchase_order}
                onValueChange={(val) => {
                  setData({
                    purchase_order_item: val,
                    purchase_order_item_id: val?.id,
                    unit: val?.unit,
                    conversion_factor: val?.conversion_factor,
                    quantity: val?.unreceived_quantity,
                    description: val?.description,
                    target_warehouse: val?.target_warehouse,
                  });
                }}
                {...attributes}
                as="item:item.item_id"
                canNavigation="App\Models\Inventory\Item"
                filters={{
                  purchase_order_id: data.purchase_order?.id ?? null,
                  unreceived_quantity: { ">": 0 },
                }}
                with={[
                  "item",
                  "unit",
                  "targetWarehouse",
                  "targetWarehouse.branch",
                ]}
                fields={[
                  "unreceived_quantity",
                  "description",
                  "conversion_factor",
                  "target_warehouse",
                ]}
              />
              <AssetCompletionRowBadge
                fixedAssets={fixedAssets}
                sourceItemId={dataRow.id}
                sourceItemIdKey="purchase_receipt_item_id"
                sourceDocumentType="purchase_receipt"
                sourceDocumentId={purchaseReceiptId}
              />
            </div>
          );
        },
      },
      {
        name: "target_warehouse",
        titleTrans: "purchase.purchaseReceipt.columns.target_warehouse",
        required: true,
        type: "text",
        width: 2,
        cell({ dataRow, data, setData, attributes }) {
          return (
            <WarehouseLinkModel
              disabled={!dataRow?.purchase_order_item_id}
              value={data}
              onValueChange={(e) => setData("target_warehouse", e)}
              {...attributes}
            />
          );
        },
      },
      {
        name: "quantity",
        titleTrans: "purchase.purchaseReceipt.columns.quantity",
        required: true,

        type: "number",
        width: 1,
        cell({ dataRow, data, setData, attributes }) {
          return (
            <NumberInput
              {...attributes}
              disabled={!dataRow?.purchase_order_item_id}
              readOnly={
                attributes.readOnly || (dataRow.readOnly && !dataRow.isCustom)
              }
              value={data}
              onValueChange={(value) => {
                setData("quantity", value);
              }}
            />
          );
        },
      },
      {
        name: "unit",
        titleTrans: "purchase.purchaseReceipt.columns.unit",
        required: true,
        cell({ data, setData, attributes, dataRow }) {
          return (
            <ItemUnitLinkModel
              disabled={!dataRow?.purchase_order_item_id}
              placeholder={t(
                "purchase.purchaseReceipt.columns.unit.placeholder",
              )}
              value={data}
              onValueChange={(val) =>
                setData({
                  unit: val,
                  conversion_factor: val?.conversion_factor,
                })
              }
              {...attributes}
              filters={{
                item_id: dataRow?.purchase_order_item?.item?.item_id,
              }}
            />
          );
        },
      },
      {
        name: "description",
        titleTrans: "purchase.purchaseReceipt.columns.description",
        cell({ data, setData, attributes, dataRow }) {
          return (
            <Textarea
              disabled={!dataRow?.purchase_order_item_id}
              value={data}
              onValueChange={(val) => setData("description", val)}
              {...attributes}
            />
          );
        },
      },
    ];
  }, []);
  return (
    <>
      <FormPageContent
        value="detail"
        title={t("purchase.purchaseReceipt.detail")}
      >
        <div className="grid gap-x-4 gap-y-4 md:grid-cols-2 [&>div]:grid [&>div]:gap-y-4 [&>div]:grid-cols-1 [&>div]:content-start">
          <div>
            <FormInput
              label={t("purchase.purchaseReceipt.columns.date")}
              required
              name="date"
            >
              <DatetimePicker
                type="datetime"
                value={data.date}
                onValueChange={(val) => setData("date", val)}
              />
            </FormInput>
            <FormInput
              label={t("purchase.purchaseReceipt.columns.purchase_order")}
              required
              name="purchase_order"
              disabled={data.is_return && !data.purchase_order}
              readOnly={data.is_return}
            >
              <PurchaseOrderLinkModel
                with={[
                  "items",
                  "items.item",
                  "items.unit",
                  "items.targetWarehouse",
                  "items.targetWarehouse.branch",
                  "supplier",
                ]}
                fields={[
                  "items.unreceived_quantity",
                  "items.description",
                  "items.conversion_factor",
                  "items.target_warehouse",
                  "items.unit",
                ]}
                disabledAddButton
                value={data.purchase_order}
                onValueChange={(val) => {
                  setData((prev) => {
                    return {
                      ...prev,
                      purchase_order: val,
                      supplier: val?.supplier,
                      items: val?.items?.map((item) => {
                        return {
                          id: generateRandom(5),
                          purchase_order_item: item,
                          purchase_order_item_id: item.id,
                          description: item.description,
                          quantity: item.unreceived_quantity ?? 0,
                          unit: item.unit,
                          conversion_factor: item.conversion_factor,
                          target_warehouse: item.target_warehouse,
                        };
                      }),
                    };
                  });
                }}
              />
            </FormInput>
            <FormInput
              name="supplier"
              label={t("purchase.purchaseReceipt.columns.supplier")}
              required
            >
              <SupplierLinkModel
                value={data.supplier}
                onValueChange={(val) => setData("supplier", val)}
              />
            </FormInput>
          </div>
          <div>
            <FormCheckbox
              className="mt-8 mb-3"
              label={t("purchase.purchaseReceipt.columns.is_return")}
              checked={data.is_return}
              onCheckedChange={(val) => {
                setData((prev) => ({
                  ...prev,
                  is_return: val,
                  purchase_order: undefined,
                  supplier: undefined,
                  items: [],
                  external_note: undefined,
                  return_against: undefined,
                }));
              }}
            />
            {data.is_return && (
              <FormInput
                label={t("purchase.purchaseReceipt.columns.return_against")}
                name="return_against"
                required
              >
                <PurchaseReceiptLinkModel
                  filters={{
                    date: {
                      "<=": data?.date ?? new Date().toISOString(),
                    },
                    status: {
                      jsonContains: ["partially_received", "received"],
                    },
                  }}
                  with={[
                    "purchaseOrder",
                    "supplier",
                    "items",
                    "items.item",
                    "items.unit",
                    "items.targetWarehouse",
                  ]}
                  value={data.return_against}
                  onValueChange={(val) => {
                    setData((prev) => ({
                      ...prev,
                      return_against: val,
                      purchase_order: val?.purchase_order,
                      supplier: val?.supplier,
                      items: val?.items?.map((item) => ({
                        id: generateRandom(8),
                        return_against_item_id: item.id,
                        purchase_order_item_id: item.purchase_order_item_id,
                        quantity: item.unreturned_quantity ?? 0,
                        required_quantity: item.unreturned_quantity,
                        unit: item.unit,
                        description: item.description,
                        target_warehouse: item.target_warehouse,
                      })),
                    }));
                  }}
                />
              </FormInput>
            )}
          </div>
        </div>
      </FormPageContent>
      <FormPageContent
        value="detail"
        title={t("purchase.purchaseReceipt.items")}
      >
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <FormTable
            name="PurchaseReceiptItems"
            className="col-start-1 col-span-2"
            columns={itemColumns}
            value={data?.items}
            onValueChange={(v) => setData("items", v)}
            form={<ItemForm />}
          />
        </div>
      </FormPageContent>
      <FormPageContent
        value="detail"
        title={t("purchase.purchaseReceipt.columns.external_note")}
        collapsible
      >
        <div className="px-1 py-1">
          <FormInput name="external_note">
            <Textarea
              rows={3}
              value={data.external_note ?? ""}
              onChange={(e) => setData("external_note", e.target.value)}
            />
          </FormInput>
        </div>
      </FormPageContent>
    </>
  );
}

export default Form;
