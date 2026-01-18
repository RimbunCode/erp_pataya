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
import ItemVariantLinkModel from "@/Pages/Inventory/Items/ItemVariantLinkModel";
import LinkModel from "@/Components/LinkModel";
import PermissionLinkModel from "@/Pages/Core/PermissionLinkModel";
import { Textarea } from "@/Components/ui/textarea";
import UnitLinkModel from "@/Pages/Inventory/Units/UnitLinkModel";
import WarehouseLinkModel from "@/Pages/Inventory/Warehouses/WarehouseLinkModel";
import { generateRandom } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Form() {
  const { t } = useLaravelReactI18n();
  const { data, setData, defaultData } = useFormPage();
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
                setData({
                  item: val,
                  unit: val?.default_unit,
                  source_warehouse: data.source_warehouse,
                });
              }}
              {...attributes}
              filters={{
                category: {
                  type: {
                    in: ["service", "stock"],
                  },
                },
              }}
              with={["defaultUnit", "item"]}
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
            <UnitLinkModel
              disabled={!dataRow?.item}
              placeholder={t("inventory.deliveryNote.columns.unit.placeholder")}
              value={data}
              onValueChange={(val) => setData("unit", val)}
              {...attributes}
              readOnly={false}
              filters={{
                group: dataRow?.item?.default_unit?.group,
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
        <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
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
          <FormInput
            label={t("inventory.deliveryNote.columns.reference_to")}
            className="col-start-1"
            required
            name="reference_to"
          >
            <PermissionLinkModel
              filters={{
                model: { in: ["App\\Models\\Sales\\SalesOrder"] },
              }}
              value={data.model}
              onValueChange={(val) => {
                setData("model", val);
              }}
            />
          </FormInput>
          <FormInput
            label={data.model?.name ?? "-"}
            name="referenceable"
            required
            disabled={!data.model}
          >
            <LinkModel
              model={data.model?.model ?? ""}
              disabledAddButton
              filters={{
                date: {
                  "<=": data?.delivery_date ?? new Date().toISOString(),
                },
                status: {
                  jsonContains: defaultData?.return_against
                    ? ["delivered", "partially_delivered"]
                    : ["to_deliver", "partially_delivered"],
                },
              }}
              with={[
                "items",
                "customer",
                "customer_branch",
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
                    referenceable_type: data.model?.model,
                    referenceable_id: val?.id,
                    customer: val?.customer,
                    customer_branch: val?.customer_branch,
                    items: val?.items.map((item) => {
                      return {
                        ...item,
                        id: generateRandom(8),
                        referenceable_type: data.model?.model + "Item",
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
          <FormInput
            className="col-start-1"
            label={t("inventory.deliveryNote.customer")}
            required={true}
            name="customer"
            readOnly
          >
            <CustomerLinkModel
              disabled={data.for_internal}
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
          <FormInput
            label={t("inventory.deliveryNote.branch")}
            required
            name="customer_branch"
            readOnly
          >
            <BranchLinkModel
              disabled={!data.customer}
              value={data.customer_branch}
              onValueChange={(val) => setData("customer_branch", val)}
              disabledNavigation={true}
              filters={{
                branchable_type: "App\\Models\\Sales\\Customer",
                branchable_id: data.customer?.id ?? null,
              }}
            />
          </FormInput>
          {defaultData?.return_against && (
            <>
              <FormCheckbox
                name="is_return"
                readOnly
                label={t("inventory.deliveryNote.columns.is_return")}
                checked={!!data.return_against}
              />
              <FormInput
                className="col-start-1"
                label={t("inventory.deliveryNote.columns.return_against")}
                name="return_against"
                readOnly
              >
                <DeliveryNoteLinkModel value={data.return_against} />
              </FormInput>
            </>
          )}
        </div>
      </FormPageContent>
      <FormPageContent value="detail" title={t("inventory.deliveryNote.items")}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <FormInput
            label={t("inventory.deliveryNote.columns.insert_item")}
            disabled={!data.model}
          >
            <LinkModel
              model={(data.model?.model ?? "") + "Item"}
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
                        referenceable_type: data.model?.model + "Item",
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
            name="items"
            className="col-start-1 col-span-2"
            readOnly={true}
            forceCanDelete
            columns={itemColumns}
            value={data?.items ?? []}
            onValueChange={(v) => setData("items", v)}
            mapItem={({ item }) => {
              const amount = item.quantity * item.price;
              const rateAmount = (amount * (item.tax?.rate ?? 0)) / 100;
              return {
                ...item,
                tax_amount: rateAmount,
                basic_amount: amount,
              };
            }}
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
