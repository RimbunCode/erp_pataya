import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import React, { useMemo } from "react";

import AssetLinkModel from "@/Pages/Asset/Assets/AssetLinkModel";
import BranchLinkModel from "@/Pages/Settings/Branches/BranchLinkModel";
import NumberInput from "@/Components/NumberInput";
import CustomerLinkModel from "@/Pages/Sales/Customers/CustomerLinkModel";
import DatetimePicker from "@/Components/DatetimePicker";
import DeliveryNoteLinkModel from "./DeliveryNoteLinkModel";
import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import ItemUnitLinkModel from "@/Pages/Inventory/Items/ItemUnitLinkModel";
import LinkModel from "@/Components/LinkModel";
import PermissionLinkModel from "@/Pages/Core/PermissionLinkModel";
import { Textarea } from "@/Components/ui/textarea";
import WarehouseLinkModel from "@/Pages/Inventory/Warehouses/WarehouseLinkModel";
import { generateRandom } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Form() {
  const { t } = useLaravelReactI18n();
  const { data, setData, defaultData, dataBefore } = useFormPage(
    {
      delivery_date: new Date(),
    },
    {
      trackDefaultValue: false,
    },
  );
  const itemColumns = useMemo(() => {
    return [
      {
        name: "item",
        titleTrans: "inventory.deliveryNote.columns.item",
        required: true,
        width: 2,
        cell({ dataRow, setData, attributes }) {
          const referenceItemModel = (data.reference_to?.model ?? "") + "Item";
          return (
            <LinkModel
              model={referenceItemModel}
              disabledAddButton
              placeholder={t("inventory.deliveryNote.columns.item.placeholder")}
              value={
                dataRow.referenceable ??
                (dataRow.referenceable_id
                  ? { id: dataRow.referenceable_id }
                  : null)
              }
              disabled={!data.referenceable}
              onValueChange={(val) => {
                setData({
                  referenceable: val,
                  referenceable_id: val?.id,
                  referenceable_type: referenceItemModel,
                  // item TIDAK disimpan — item_id diambil backend dari referenceable
                  unit: val?.unit,
                  source_warehouse: val?.source_warehouse,
                  conversion_factor: val?.conversion_factor,
                  quantity: val?.undelivered_quantity,
                  required_quantity: val?.undelivered_quantity,
                });
              }}
              {...attributes}
              as="item:item.item_id"
              canNavigation="App\Models\Inventory\Item"
              filters={{
                ...(data.reference_to?.model ===
                "App\\Models\\Sales\\SalesOrder"
                  ? { sales_order_id: data?.referenceable?.id }
                  : { internal_order_id: data?.referenceable?.id }),
                undelivered_quantity: { ">": 0 },
              }}
              with={[
                "item",
                "unit",
                "sourceWarehouse",
                "sourceWarehouse.branch",
              ]}
              fields={[
                "undelivered_quantity",
                "conversion_factor",
                "source_warehouse",
              ]}
            />
          );
        },
      },
      {
        name: "description",
        titleTrans: "inventory.deliveryNote.columns.description",
        show: false,
        type: "text",
        width: 2,
        cell({ dataRow, data, setData, attributes }) {
          return (
            <Textarea
              disabled={!dataRow?.referenceable}
              rows={1}
              value={data ?? ""}
              onChange={(e) => setData("description", e.target.value)}
              {...attributes}
            />
          );
        },
      },
      {
        name: "source_warehouse",
        titleTrans: "inventory.deliveryNote.columns.source_warehouse",
        show: true,
        type: "text",
        width: 2,
        required: true,
        cell({ dataRow, data, setData, attributes }) {
          return (
            <WarehouseLinkModel
              disabled={!dataRow?.referenceable}
              placeholder={t(
                "inventory.deliveryNote.columns.source_warehouse.placeholder",
              )}
              value={data}
              onValueChange={(val) => setData("source_warehouse", val)}
              {...attributes}
            />
          );
        },
      },
      {
        name: "quantity",
        titleTrans: "inventory.deliveryNote.columns.quantity",
        required: true,
        type: "number",
        width: 1,
        cell({ dataRow, data, setData, attributes }) {
          return (
            <NumberInput
              {...attributes}
              disabled={!dataRow?.referenceable}
              readOnly={false}
              value={data}
              onValueChange={(value) => {
                setData("quantity", value);
              }}
              max={dataRow.required_quantity}
            />
          );
        },
      },
      {
        name: "unit",
        titleTrans: "inventory.deliveryNote.columns.unit",
        required: true,
        cell({ data, setData, attributes, dataRow }) {
          return (
            <ItemUnitLinkModel
              disabled={!dataRow?.referenceable}
              placeholder={t("inventory.deliveryNote.columns.unit.placeholder")}
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
                  dataRow?.referenceable?.item?.id ??
                  dataRow?.referenceable?.item_id ??
                  dataRow?.item?.id,
              }}
            />
          );
        },
      },
      {
        name: "asset_lines",
        titleTrans: "inventory.deliveryNote.columns.asset_lines",
        show: false,
        width: 3,
        cell({ dataRow, data, setData, attributes }) {
          const itemId =
            dataRow?.referenceable?.item?.item_id ??
            dataRow?.referenceable?.item_id;
          const isFixedAsset = !!dataRow?.referenceable?.item?.is_fixed_asset;
          if (!isFixedAsset) {
            return <span className="text-muted-foreground">-</span>;
          }
          const totalAssetQuantity = (data ?? []).reduce(
            (sum, line) => sum + (Number(line.quantity) || 0),
            0,
          );
          const mismatch = totalAssetQuantity !== (dataRow.quantity ?? 0);
          return (
            <div className="flex w-full flex-col gap-y-1">
              <FormTable
                name="DeliveryNoteItemAssetLines"
                ignoreDisabled
                readOnly={attributes.readOnly}
                columns={[
                  {
                    name: "asset",
                    titleTrans:
                      "inventory.deliveryNote.columns.asset_lines.asset",
                    required: true,
                    width: 2,
                    cell({
                      dataRow: _assetRow,
                      data: assetData,
                      setData: setAssetData,
                      attributes: assetAttrs,
                    }) {
                      return (
                        <AssetLinkModel
                          placeholder={t(
                            "inventory.deliveryNote.columns.asset_lines.asset.placeholder",
                          )}
                          value={assetData}
                          onValueChange={(val) => setAssetData("asset", val)}
                          {...assetAttrs}
                          filters={{
                            item_id: itemId,
                            available_quantity: { ">": 0 },
                          }}
                        />
                      );
                    },
                  },
                  {
                    name: "quantity",
                    titleTrans:
                      "inventory.deliveryNote.columns.asset_lines.quantity",
                    required: true,
                    type: "number",
                    width: 1,
                    cell({
                      data: qty,
                      setData: setAssetData,
                      attributes: assetAttrs,
                    }) {
                      return (
                        <NumberInput
                          {...assetAttrs}
                          value={qty}
                          onValueChange={(val) => setAssetData("quantity", val)}
                        />
                      );
                    },
                  },
                ]}
                value={data ?? []}
                onValueChange={(v) => setData("asset_lines", v)}
              />
              {mismatch && (
                <p className="text-xs text-destructive">
                  {t(
                    "inventory.deliveryNote.columns.asset_lines.quantity_mismatch",
                    { quantity: dataRow.quantity ?? 0 },
                  )}
                </p>
              )}
            </div>
          );
        },
      },
    ];
  }, [data, t]);
  return (
    <>
      <FormPageContent
        value="detail"
        title={t("inventory.deliveryNote.detail")}
      >
        <div className="grid gap-x-4 gap-y-4 md:grid-cols-2 [&>div]:grid [&>div]:gap-y-4 [&>div]:grid-cols-1 [&>div]:content-start">
          <div>
            <FormInput
              name="date"
              label={t("inventory.deliveryNote.columns.delivery_date")}
              required
            >
              <DatetimePicker
                type="datetime"
                value={data?.delivery_date}
                onValueChange={(val) => {
                  setData("delivery_date", val);
                }}
              />
            </FormInput>
            {(!data.is_return || data.return_against) && (
              <FormInput
                label={t("inventory.deliveryNote.columns.reference_to")}
                className="col-start-1"
                required
                disabled={data.is_return && !data.reference_to}
                readOnly={data.is_return}
                name="reference_to"
              >
                <PermissionLinkModel
                  filters={{
                    is_submitable: true,
                    model: {
                      in: [
                        "App\\Models\\Sales\\SalesOrder",
                        "App\\Models\\Sales\\InternalOrder",
                      ],
                    },
                  }}
                  fields={["model", "is_submitable"]}
                  value={data.reference_to}
                  onValueChange={(val) => {
                    setData((prev) => ({
                      ...prev,
                      reference_to: val,
                      referenceable: val ? prev.referenceable : null,
                      customer: val ? prev.customer : null,
                      customer_branch: val ? prev.customer_branch : null,
                      items: val ? prev.items : null,
                    }));
                  }}
                />
              </FormInput>
            )}
            {data.reference_to && (
              <FormInput
                label={data.reference_to?.name ?? "-"}
                name="referenceable"
                required
                disabled={!data.reference_to}
                readOnly={data.is_return}
              >
                <LinkModel
                  model={data.reference_to?.model ?? ""}
                  disabledAddButton
                  filters={{
                    date: {
                      "<=": data?.delivery_date ?? new Date().toISOString(),
                    },
                    status: {
                      jsonContains: data?.return_against
                        ? ["delivered", "partially_delivered"]
                        : ["to_deliver", "partially_delivered"],
                    },
                  }}
                  with={[
                    "items",
                    ...(data.reference_to?.model ==
                    "App\\Models\\Sales\\SalesOrder"
                      ? ["customer", "customerBranch"]
                      : ["branch"]),
                    "items.item",
                    "items.unit",
                    "items.sourceWarehouse",
                    "items.sourceWarehouse.branch",
                  ]}
                  fields={[
                    "items.item",
                    "items.unit",
                    "items.source_warehouse",
                    "items.quantity",
                    "items.description",
                    "items.undelivered_quantity",
                    "items.conversion_factor",
                  ]}
                  value={data.referenceable}
                  onValueChange={(val) => {
                    setData((prev) => {
                      return {
                        ...prev,
                        referenceable: val,
                        referenceable_type: data.reference_to?.model,
                        referenceable_id: val?.id,
                        customer: val?.customer,
                        customer_branch: val?.customer_branch ?? val?.branch,
                        items: val?.items?.map((item) => {
                          return {
                            ...item,
                            id: generateRandom(8),
                            referenceable: item,
                            referenceable_type:
                              data.reference_to?.model + "Item",
                            referenceable_id: item.id,
                            source_warehouse: item.source_warehouse,
                            quantity: item.undelivered_quantity ?? 0,
                            required_quantity: item.undelivered_quantity ?? 0,
                          };
                        }),
                        external_note: val?.external_note,
                      };
                    });
                  }}
                />
              </FormInput>
            )}
          </div>
          <div>
            <FormCheckbox
              className="mt-8 mb-3"
              name="is_return"
              label={t("inventory.deliveryNote.columns.is_return")}
              checked={data.is_return || data.return_against}
              valueBefore={
                dataBefore?.is_return != null ||
                dataBefore?.return_against != null
                  ? dataBefore?.is_return || dataBefore?.return_against
                  : undefined
              }
              onCheckedChange={(val) =>
                setData((prev) => ({
                  ...prev,
                  is_return: val,
                  return_against: undefined,
                  referenceable: undefined,
                  reference_to: undefined,
                  customer: undefined,
                  customer_branch: undefined,
                  items: [],
                }))
              }
            />
            {data.is_return && (
              <FormInput
                className="col-start-1"
                label={t("inventory.deliveryNote.columns.return_against")}
                name="return_against"
                required
              >
                <DeliveryNoteLinkModel
                  filters={{
                    delivery_date: {
                      "<=": data?.delivery_date ?? new Date().toISOString(),
                    },
                    status: {
                      jsonContains: ["partially_delivered", "delivered"],
                    },
                  }}
                  appends={["model"]}
                  with={[
                    "referenceable",
                    "referenceTo",
                    "customer",
                    "customerBranch",
                    "items",
                    "items.referenceable",
                    "items.unit",
                    "items.sourceWarehouse",
                  ]}
                  value={data.return_against}
                  onValueChange={(val) => {
                    setData((prev) => ({
                      ...prev,
                      return_against: val,
                      reference_to: val?.reference_to,
                      referenceable: val?.referenceable,
                      customer: val?.customer,
                      customer_branch: val?.customer_branch,
                      items: val?.items?.map((item) => ({
                        ...item,
                        id: generateRandom(8),
                        return_against_item: item,
                        quantity: item.unreturned_quantity,
                        required_quantity: item.unreturned_quantity,
                      })),
                    }));
                  }}
                />
              </FormInput>
            )}
            {data.referenceable_type === "App\\Models\\Sales\\SalesOrder" && (
              <FormInput
                className="col-start-1"
                label={t("inventory.deliveryNote.columns.customer")}
                required={
                  data.referenceable_type === "App\\Models\\Sales\\SalesOrder"
                }
                name="customer"
                readOnly
                disabled={!data.referenceable}
              >
                <CustomerLinkModel
                  with={["branches"]}
                  fields={["branches.is_main_branch"]}
                  value={data.for_internal ? "" : data.customer}
                  onValueChange={(val) => {
                    if (val?.branches?.length <= 1) {
                      setData("customer_branch", val.branches?.[0]);
                    }
                    setData("customer", val);
                  }}
                />
              </FormInput>
            )}
            {data.referenceable && (
              <FormInput
                label={t(
                  data.referenceable_type === "App\\Models\\Sales\\SalesOrder"
                    ? "inventory.deliveryNote.columns.customer_branch"
                    : "inventory.deliveryNote.columns.internal_branch",
                )}
                required
                name="customer_branch"
                readOnly
              >
                <BranchLinkModel
                  disabled={
                    !data?.referenceable &&
                    data.referenceable_type ===
                      "App\\Models\\Sales\\SalesOrder" &&
                    !data.customer
                  }
                  value={data.customer_branch}
                  onValueChange={(val) => setData("customer_branch", val)}
                  disabledNavigation={true}
                  filters={
                    data.referenceable_type === "App\\Models\\Sales\\SalesOrder"
                      ? {
                          branchable_type: "App\\Models\\Sales\\Customer",
                          branchable_id: data.customer?.id ?? null,
                        }
                      : {
                          branchable_type: null,
                          branchable_id: null,
                        }
                  }
                />
              </FormInput>
            )}
          </div>
        </div>
      </FormPageContent>
      <FormPageContent value="detail" title={t("inventory.deliveryNote.items")}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <FormTable
            name="DeliveryNoteItems"
            className="col-start-1 col-span-2"
            columns={itemColumns}
            value={data?.items ?? []}
            onValueChange={(v) => setData("items", v)}
          />
        </div>
      </FormPageContent>

      <FormPageContent
        value="detail"
        title={t("inventory.deliveryNote.columns.external_note")}
        collapsible
        defaultOpen={defaultData?.external_note}
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
