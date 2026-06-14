import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import React, { useMemo } from "react";

import BranchLinkModel from "@/Pages/Settings/Branches/BranchLinkModel";
import CurrencyInput from "@/Components/CurrencyInput";
import CustomerLinkModel from "@/Pages/Sales/Customers/CustomerLinkModel";
import DatetimePicker from "@/Components/DatetimePicker";
import DeliveryNoteLinkModel from "./DeliveryNoteLinkModel";
import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import ItemUnitLinkModel from "@/Pages/Inventory/Items/ItemUnitLinkModel";
import ItemVariantLinkModel from "@/Pages/Inventory/Items/ItemVariantLinkModel";
import LinkModel from "@/Components/LinkModel";
import PermissionLinkModel from "@/Pages/Core/PermissionLinkModel";
import { Textarea } from "@/Components/ui/textarea";
import WarehouseLinkModel from "@/Pages/Inventory/Warehouses/WarehouseLinkModel";
import { generateRandom } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Form() {
  const { t } = useLaravelReactI18n();
  const { data, setData, defaultData } = useFormPage(
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
          return (
            <ItemVariantLinkModel
              placeholder={t("inventory.deliveryNote.columns.item.placeholder")}
              value={dataRow.item}
              onValueChange={(val) => {
                const defaultUnit = val?.default_uom;
                setData({
                  item: val,
                  unit: defaultUnit,
                  conversion_factor: defaultUnit?.conversion_factor,
                  source_warehouse: data.source_warehouse,
                });
              }}
              {...attributes}
              filters={{
                is_stock_item: true,
              }}
              with={["defaultUom", "item"]}
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
              disabled={!dataRow?.item}
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
              disabled={!dataRow?.item}
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
            <CurrencyInput
              {...attributes}
              disabled={!dataRow?.item}
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
              disabled={!dataRow?.item}
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
                item_id: dataRow?.item?.item_id,
              }}
            />
          );
        },
      },
    ];
  }, [data]);
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
                    model: {
                      in: [
                        "App\\Models\\Sales\\SalesOrder",
                        "App\\Models\\Sales\\InternalOrder",
                      ],
                    },
                  }}
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
                        items: val?.items.map((item) => {
                          return {
                            ...item,
                            id: generateRandom(8),
                            referenceable_type:
                              data.reference_to?.model + "Item",
                            referenceable_id: item.id,
                            quantity: item.undelivered_quantity,
                            required_quantity: item.undelivered_quantity,
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
                      "<=": data?.date ?? new Date().toISOString(),
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
                    "items.item",
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
                        return_against_item_id: item.id,
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
          <FormInput
            label={t("inventory.deliveryNote.columns.insert_item")}
            disabled={!data.reference_to}
          >
            <LinkModel
              model={(data.reference_to?.model ?? "") + "Item"}
              disabledAddButton
              with={["item", "sourceWarehouse", "unit"]}
              filters={{
                sales_order_id: data?.referenceable?.id,
                undelivered_quantity: {
                  ">": 0,
                },
                id: {
                  notIn: data?.items?.map((x) => x.referenceable_id),
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
                        referenceable_type: data.reference_to?.model + "Item",
                        referenceable_id: item.id,
                        quantity: item.undelivered_quantity,
                      },
                    ],
                  };
                });
              }}
            />
          </FormInput>
          <FormTable
            name="DeliveryNoteItems"
            className="col-start-1 col-span-2"
            readOnly={true}
            forceCanDelete
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
