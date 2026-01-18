import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import React from "react";
import CurrencyInput from "@/Components/CurrencyInput";
import DatetimePicker from "@/Components/DatetimePicker";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import ItemForm from "./ItemForm";
import ItemVariantLinkModel from "@/Pages/Inventory/Items/ItemVariantLinkModel";
import { Textarea } from "@/Components/ui/textarea";
import UnitLinkModel from "@/Pages/Inventory/Units/UnitLinkModel";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useMemo } from "react";
import PurchaseOrderLinkModel from "../PurchaseOrders/PurchaseOrderLinkModel";
import SupplierLinkModel from "../Suppliers/SupplierLinkModel";
import WarehouseLinkModel from "@/Pages/Inventory/Warehouses/WarehouseLinkModel";
import { generateRandom } from "@/lib/utils";

function Form() {
  const { t } = useLaravelReactI18n();
  const { data, setData, disabled } = useFormPage();

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
        <div className="flex flex-col gap-y-4">
          <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
            <FormInput
              label={t("purchase.purchaseReceipt.columns.purchase_order")}
              required
              name="purchase_order"
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
              label={t("purchase.purchaseReceipt.columns.received_date")}
              required
              name="received_date"
            >
              <DatetimePicker
                type="datetime"
                value={data.received_date}
                onValueChange={(val) => setData("received_date", val)}
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
        </div>
      </FormPageContent>
      <FormPageContent
        value="detail"
        title={t("purchase.purchaseReceipt.items")}
      >
        <FormTable
          readOnly={true}
          columns={itemColumns}
          value={data?.items}
          onValueChange={(v) => setData("items", v)}
          form={<ItemForm />}
        />
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
