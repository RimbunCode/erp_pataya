import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import React, { useCallback, useEffect } from "react";
import SelectModel, { loadFromModel } from "@/Components/SelectModel";

import CurrencyInput from "@/Components/CurrencyInput";
import CurrencyLinkModel from "@/Pages/Core/CurrencyLinkModel";
import DatetimePicker from "@/Components/DatetimePicker";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import ItemForm from "./ItemForm";
import ItemVariantLinkModel from "@/Pages/Inventory/Items/ItemVariantLinkModel";
import SupplierLinkModel from "../Suppliers/SupplierLinkModel";
import { Textarea } from "@/Components/ui/textarea";
import UnitLinkModel from "@/Pages/Inventory/Units/UnitLinkModel";
import { generateRandom } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useMemo } from "react";
import { usePage } from "@inertiajs/react";

function Form() {
  const { t } = useLaravelReactI18n();
  const { data, setData, disabled } = useFormPage();
  const loadFrom = usePage().props.loadFrom;
  const { default_currency_id } = usePage().props.preferences;

  const mergeItems = useCallback(
    (value, model) => {
      setData((prev) => {
        const oldItems = prev.items ?? [];

        // Buat Map untuk lookup cepat
        const itemMap = new Map(
          oldItems.map((item) => [
            `${item.referenceable_type}_${item.referenceable_id}`,
            item,
          ]),
        );

        value.forEach((item) => {
          const key = `${model}_${item.id}`;
          const newItem = {
            // ...item,
            id: generateRandom(5),
            item: item.item,
            description: item.description,
            required_date: prev.required_date,
            quantity: item.remaining_quantity,
            unit: item.unit,
            referenceable_type: model,
            referenceable_id: item.id,
          };
          if (newItem.quantity <= 0) {
            itemMap.delete(key);
          }
          if (itemMap.has(key)) {
            // update quantity sesuai newItem
            itemMap.set(key, {
              ...itemMap.get(key),
              ...newItem,
            });
          } else {
            // tambah item baru
            itemMap.set(key, newItem);
          }
        });

        return {
          ...prev,
          items: Array.from(itemMap.values()),
        };
      });
    },
    [setData],
  );
  useEffect(() => {
    if (!loadFrom) return;
    const fetchData = async () => {
      const data = await loadFromModel(
        loadFrom?.model,
        loadFrom?.id,
        loadFrom?.select,
      );
      console.log(data);
      mergeItems(data.value, data.model);
    };
    fetchData().catch(console.error);
  }, [loadFrom, mergeItems]);
  const itemColumns = useMemo(() => {
    return [
      {
        name: "item",
        titleTrans: "purchase.purchaseOrder.columns.item",
        required: true,
        width: 3,
        cell({ dataRow, setData, attributes }) {
          return (
            <ItemVariantLinkModel
              placeholder={t("purchase.purchaseOrder.columns.item.placeholder")}
              value={dataRow?.item}
              onValueChange={(val) => {
                setData({
                  item: val,
                  unit: val?.default_unit,
                  required_date: data.required_date,
                });
              }}
              {...attributes}
              with={["defaultUnit", "item"]}
            />
          );
        },
      },
      {
        name: "description",
        titleTrans: "purchase.purchaseOrder.columns.description",
        show: true,
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
        name: "required_date",
        titleTrans: "purchase.purchaseOrder.columns.required_date",
        required: true,
        type: "date",
        width: 1,
        cell({ dataRow, data, setData, attributes }) {
          return (
            <DatetimePicker
              {...attributes}
              disabled={!dataRow?.item}
              value={data}
              onValueChange={(value) => {
                setData("required_date", value);
              }}
            />
          );
        },
      },
      {
        name: "quantity",
        titleTrans: "purchase.purchaseOrder.columns.quantity",
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
        titleTrans: "purchase.purchaseOrder.columns.unit",
        required: true,
        cell({ data, setData, attributes, dataRow }) {
          return (
            <UnitLinkModel
              disabled={!dataRow?.item}
              placeholder={t("purchase.purchaseOrder.columns.unit.placeholder")}
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
    ];
  }, [data.required_date, t]);
  return (
    <>
      <FormPageContent value="detail">
        <div className="flex flex-col gap-y-4">
          <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
            <FormInput
              label={t("purchase.purchaseOrder.columns.date")}
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
              label={t("purchase.purchaseOrder.columns.required_date")}
              required
              name="required_date"
            >
              <DatetimePicker
                type="datetime"
                value={data.required_date}
                onValueChange={(val) => {
                  setData((prev) => {
                    const items = data?.items?.map((item) => {
                      return {
                        ...item,
                        required_date: val,
                      };
                    });

                    return {
                      ...prev,
                      required_date: val,
                      items,
                    };
                  });
                }}
              />
            </FormInput>
            <FormInput
              label={t("purchase.purchaseOrder.columns.supplier")}
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
        title={t("purchase.purchaseOrder.columns.currency")}
      >
        <div className="grid grid-cols-2 gap-x-4">
          <FormInput
            className="col-start-1"
            label={t("purchase.purchaseOrder.columns.currency")}
            name="currency"
          >
            <CurrencyLinkModel
              placeholder={t(
                "purchase.purchaseOrder.columns.currency.placeholder",
              )}
              value={data.currency}
              onValueChange={(val) => {
                setData("currency", val);
              }}
              className="h-8"
            />
          </FormInput>

          {data.currency && data.currency.code != default_currency_id && (
            <FormInput
              description={`1 ${data.currency.code.toUpperCase()} = [?] ${default_currency_id.toUpperCase()}`}
              label={t("purchase.purchaseOrder.columns.exchange_rate")}
              name="exchange_rate"
            >
              <CurrencyInput
                disabled={!data.currency}
                className="text-left"
                currencyCode="default"
                decimalScale={2}
                value={data.exchange_rate}
                onValueChange={(value) => {
                  setData("exchange_rate", value);
                }}
              />
            </FormInput>
          )}
        </div>
      </FormPageContent>
      <FormPageContent
        value="detail"
        title={t("purchase.purchaseOrder.items")}
        actions={
          (!data.status || data.status == "draft") && (
            <SelectModel
              from={{
                "App\\Models\\Service\\WorkOrder": {
                  columns: ["code", "date"],
                  filters: {
                    status: "submitted",
                  },
                  select: {
                    items: {
                      filters: {
                        status: "submitted",
                      },
                      columns: [
                        "work_order",
                        "item",
                        "quantity",
                        "required_quantity",
                        "unit",
                      ],
                    },
                  },
                },
                "App\\Models\\Purchase\\PurchaseRequest": {
                  columns: ["code", "date"],
                  filters: {
                    status: "submitted",
                  },
                  select: {
                    items: {
                      filters: {
                        status: "submitted",
                      },
                      columns: [
                        "purchase_request",
                        "item",
                        "quantity",
                        "remaining_quantity",
                        "unit",
                      ],
                    },
                  },
                },
              }}
              label={t("purchase.purchaseOrder.import_items")}
              className="w-fit"
              variant="secondary"
              size="sm"
              onSelected={mergeItems}
            />
          )
        }
      >
        <FormTable
          readOnly={disabled}
          columns={itemColumns}
          value={data?.items}
          onValueChange={(v) => setData("items", v)}
          form={<ItemForm />}
        />
      </FormPageContent>
      <FormPageContent
        value="detail"
        title={t("purchase.purchaseOrder.columns.external_note")}
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
