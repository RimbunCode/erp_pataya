import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";

import CurrencyInput from "@/Components/CurrencyInput";
import DatetimePicker from "@/Components/DatetimePicker";
import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import ItemForm from "./ItemForm";
import ItemVariantLinkModel from "@/Pages/Inventory/Items/ItemVariantLinkModel";
import LinkModel from "@/Components/LinkModel";
import PurchaseOrderLinkModel from "../PurchaseOrders/PurchaseOrderLinkModel";
import PurchaseReceiptLinkModel from "./PurchaseReceiptLinkModel";
import React from "react";
import SupplierLinkModel from "../Suppliers/SupplierLinkModel";
import { Textarea } from "@/Components/ui/textarea";
import UnitLinkModel from "@/Pages/Inventory/Units/UnitLinkModel";
import WarehouseLinkModel from "@/Pages/Inventory/Warehouses/WarehouseLinkModel";
import { generateRandom } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useMemo } from "react";

function Form() {
  const { t } = useLaravelReactI18n();
  const { data, setData, defaultData } = useFormPage();

  const itemColumns = useMemo(() => {
    return [
      {
        name: "item",
        titleTrans: "purchase.purchaseReceipt.columns.item",
        required: true,
        width: 3,
        cell({ dataRow, setData, attributes }) {
          return (
            <ItemVariantLinkModel
              filters={{
                is_stock_item: true,
              }}
              placeholder={t(
                "purchase.purchaseReceipt.columns.item.placeholder",
              )}
              value={dataRow?.item}
              onValueChange={(val) => {
                setData({
                  item: val,
                  unit: val?.default_unit,
                });
              }}
              {...attributes}
              with={["defaultUnit", "item"]}
            />
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
              disabled={!dataRow?.item}
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
            <CurrencyInput
              {...attributes}
              disabled={!dataRow?.item}
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
            <UnitLinkModel
              disabled={!dataRow?.item}
              placeholder={t(
                "purchase.purchaseReceipt.columns.unit.placeholder",
              )}
              value={data}
              onValueChange={(val) => setData("unit", val)}
              {...attributes}
              filters={{
                group: dataRow?.item?.default_unit?.group,
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
              disabled={!dataRow?.item}
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
                  "supplier",
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
                          description: item.description,
                          purchase_order_item_id: item.id,
                          item: item.item,
                          quantity: item.quantity,
                          unit: item.unit,
                          required_date: item.required_date,
                          target_warehouse: item.target_warehouse,
                        };
                      }),
                    };
                  });
                }}
              />
            </FormInput>
            <FormInput
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
                    "items.tax",
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
                      items: val?.items?.map((item) => {
                        return {
                          ...item,
                          id: generateRandom(8),
                          return_against_item_id: item.id,
                          quantity: item.unreturned_quantit,
                          required_quantity: item.unreturned_quantity,
                        };
                      }),
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
          <FormInput
            label={t("inventory.deliveryNote.columns.insert_item")}
            disabled={!data.reference_to}
          >
            <LinkModel
              model="App\Models\Inventory\PurchaseReceiptItem"
              disabledAddButton
              with={["item", "targetWarehouse", "unit"]}
              filters={{
                purchase_receipt_id: defaultData?.id,
                unreceived_quantity: {
                  ">": 0,
                },
                id: {
                  notIn: data?.items?.map((x) => x.purchase_order_item_id),
                },
              }}
              value={null}
              onValueChange={(item) => {
                if (!item) return;
                setData((prev) => {
                  return {
                    ...prev,
                    items: [
                      ...prev.items,
                      {
                        ...item,
                        id: generateRandom(8),
                        purchase_order_item_id: item.id,
                        quantity: item.unreceived_quantity,
                      },
                    ],
                  };
                });
              }}
            />
          </FormInput>
          <FormTable
            name="PurchaseReceiptItems"
            className="col-start-1 col-span-2"
            readOnly={true}
            forceCanDelete
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
          <FormInput>
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
