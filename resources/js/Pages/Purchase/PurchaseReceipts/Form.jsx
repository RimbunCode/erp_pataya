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
import { EMPTY_DEFAULTS, useDocumentDefaults } from "@/lib/documentDefaults";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useMemo } from "react";
import { usePage } from "@inertiajs/react";
import WarehouseLinkModel from "@/Pages/Inventory/Warehouses/WarehouseLinkModel";

const ITEM_VARIANT_MODEL = "App\\Models\\Inventory\\ItemVariant";

// Baris di luar PO tak punya PO Item; kolom "menggantikan" dikosongkan tiap
// kali item baris diganti (spec purchase-receipt-off-po-items).
const OFF_PO_RESET = {
  replaces_purchase_order_item: null,
  replaces_purchase_order_item_id: null,
  replaced_quantity: null,
};

// Baris sudah punya item: PO Item (normal) atau ItemVariant (di luar PO).
const hasItem = (row) => !!(row?.purchase_order_item_id || row?.item?.id);

function Form() {
  const { t } = useLaravelReactI18n();
  const fixedAssets = usePage().props.fixedAssets;
  const pageProps = usePage().props;
  const purchaseReceiptId = pageProps.purchaseReceipt?.id;
  const defaults = pageProps.defaults ?? EMPTY_DEFAULTS;
  const { data, setData, isCreate } = useFormPage(
    {
      date: new Date(),
    },
    {
      trackDefaultValue: false,
      notUseWhenCreate: true,
    },
  );
  const { applyToNewLine, resolveForNewLine, markFieldEdited } =
    useDocumentDefaults(defaults, isCreate ? "purchase_receipt" : null, {
      items: data.items,
      setData,
    });

  // Id ItemVariant semua PO Item: menyaring sub model "Item Lainnya" supaya item
  // yang sudah ada di PO tidak muncul dobel di dropdown (dedupe di sisi form).
  const poVariantIds = (data.purchase_order?.items ?? [])
    .map((poItem) => poItem.item?.id ?? poItem.item_id)
    .filter(Boolean);
  const poVariantIdsKey = poVariantIds.join(",");

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
                value={dataRow.purchase_order_item ?? dataRow.item ?? null}
                disabled={!data.purchase_order}
                onValueChange={(val) => {
                  // Opsi dari sub model (ItemVariant) = baris di luar PO
                  // (spec purchase-receipt-off-po-items); opsi PO Item = baris normal.
                  if (val?.thisModel === ITEM_VARIANT_MODEL) {
                    const rowPatch = {
                      ...OFF_PO_RESET,
                      purchase_order_item: null,
                      purchase_order_item_id: null,
                      item: val,
                      unit: val.default_uom ?? null,
                      conversion_factor: val.default_uom?.conversion_factor,
                      quantity: 1,
                      description: undefined,
                    };
                    const defaultLine = applyToNewLine(
                      { ...dataRow, ...rowPatch },
                      val,
                      { warehouseField: "target_warehouse" },
                    );
                    setData({
                      ...rowPatch,
                      target_warehouse: defaultLine.target_warehouse,
                    });
                    resolveForNewLine(dataRow.id, val, {
                      warehouseField: "target_warehouse",
                    });
                    return;
                  }
                  setData({
                    ...OFF_PO_RESET,
                    item: null,
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
                mainLabel={t("purchase.purchaseReceipt.columns.item.group_po")}
                subModels={[
                  {
                    model: ITEM_VARIANT_MODEL,
                    label: t(
                      "purchase.purchaseReceipt.columns.item.group_other",
                    ),
                    // Item yang sudah ada di PO dipilih lewat PO Item, bukan di sini.
                    filters: poVariantIds.length
                      ? { id: { notIn: poVariantIds } }
                      : undefined,
                    with: ["defaultUom"],
                    fields: ["default_uom"],
                    as: "item:item_id",
                    canNavigation: "App\\Models\\Inventory\\Item",
                    disabledAddButton: true,
                  },
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
              disabled={!hasItem(dataRow)}
              value={data}
              onValueChange={(e) => {
                markFieldEdited(dataRow.id, "target_warehouse");
                setData("target_warehouse", e);
              }}
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
              disabled={!hasItem(dataRow)}
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
              disabled={!hasItem(dataRow)}
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
                item_id:
                  dataRow?.purchase_order_item?.item?.item_id ??
                  dataRow?.item?.item_id,
              }}
            />
          );
        },
      },
      {
        // Hanya baris di luar PO yang dapat menggantikan PO Item tertentu
        // (nilai stok diambil dari invoice PO Item itu); kosong = berdiri sendiri.
        name: "replaces_purchase_order_item",
        titleTrans: "purchase.purchaseReceipt.columns.replaces",
        width: 3,
        cell({ dataRow, setData, attributes }) {
          const isOffPo =
            !dataRow?.purchase_order_item_id && !!dataRow?.item?.id;

          return (
            <PurchaseOrderItemLinkModel
              placeholder={t(
                "purchase.purchaseReceipt.columns.replaces.placeholder",
              )}
              value={dataRow.replaces_purchase_order_item ?? null}
              disabled={!isOffPo || !data.purchase_order}
              onValueChange={(val) => {
                setData({
                  replaces_purchase_order_item: val,
                  replaces_purchase_order_item_id: val?.id ?? null,
                  replaced_quantity: val
                    ? Math.min(
                        Number(dataRow?.quantity ?? 0),
                        Number(val.unreceived_quantity ?? 0),
                      )
                    : null,
                });
              }}
              {...attributes}
              as="item:item.item_id"
              canNavigation="App\Models\Inventory\Item"
              filters={{
                purchase_order_id: data.purchase_order?.id ?? null,
                unreceived_quantity: { ">": 0 },
              }}
              with={["item"]}
              fields={["unreceived_quantity"]}
            />
          );
        },
      },
      {
        name: "replaced_quantity",
        titleTrans: "purchase.purchaseReceipt.columns.replaced_quantity",
        type: "number",
        width: 1,
        cell({ dataRow, data, setData, attributes }) {
          return (
            <NumberInput
              {...attributes}
              disabled={!dataRow?.replaces_purchase_order_item_id}
              value={data}
              onValueChange={(value) => {
                setData("replaced_quantity", value);
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
              disabled={!hasItem(dataRow)}
              value={data}
              onValueChange={(val) => setData("description", val)}
              {...attributes}
            />
          );
        },
      },
    ];
  }, [
    applyToNewLine,
    data.purchase_order,
    markFieldEdited,
    poVariantIdsKey,
    resolveForNewLine,
  ]);
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
                        // Baris asal di luar PO: bawa itemnya agar retur lolos validasi.
                        item: item.purchase_order_item_id ? null : item.item,
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
