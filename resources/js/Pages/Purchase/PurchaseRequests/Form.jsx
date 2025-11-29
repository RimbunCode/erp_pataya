import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import React, { useCallback } from "react";

import CurrencyInput from "@/Components/CurrencyInput";
import DatetimePicker from "@/Components/DatetimePicker";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import ItemForm from "./ItemForm";
import ItemVariantLinkModel from "@/Pages/Inventory/Items/ItemVariantLinkModel";
import SelectModel from "@/Components/SelectModel";
import { Textarea } from "@/Components/ui/textarea";
import UnitLinkModel from "@/Pages/Inventory/Units/UnitLinkModel";
import { generateRandom } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useMemo } from "react";

function Form() {
  const { t } = useLaravelReactI18n();
  const { data, setData, disabled } = useFormPage();

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
            quantity: item.required_quantity,
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
  const itemColumns = useMemo(() => {
    return [
      {
        name: "item",
        titleTrans: "purchase.purchaseRequest.columns.item",
        required: true,
        width: 3,
        cell({ dataRow, setData, attributes }) {
          return (
            <ItemVariantLinkModel
              placeholder={t(
                "purchase.purchaseRequest.columns.item.placeholder",
              )}
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
        titleTrans: "purchase.purchaseRequest.columns.description",
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
        titleTrans: "purchase.purchaseRequest.columns.required_date",
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
        titleTrans: "purchase.purchaseRequest.columns.quantity",
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
        titleTrans: "purchase.purchaseRequest.columns.unit",
        required: true,
        cell({ data, setData, attributes, dataRow }) {
          return (
            <UnitLinkModel
              disabled={!dataRow?.item}
              placeholder={t(
                "purchase.purchaseRequest.columns.unit.placeholder",
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
    ];
  }, []);
  return (
    <>
      <FormPageContent
        value="detail"
        title={t("purchase.purchaseRequest.detail")}
      >
        <div className="flex flex-col gap-y-4">
          <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
            <FormInput
              label={t("purchase.purchaseRequest.columns.date")}
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
              label={t("purchase.purchaseRequest.columns.required_date")}
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
          </div>
        </div>
      </FormPageContent>
      <FormPageContent
        value="detail"
        title={t("purchase.purchaseRequest.items")}
        actions={
          !data.submitted_at && (
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
              }}
              label={t("purchase.purchaseRequest.import_items")}
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
        title={t("purchase.purchaseRequest.columns.external_note")}
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
