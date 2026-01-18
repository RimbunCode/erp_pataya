import {
  FormPageContent,
  FormPageContentTitle,
  useFormPage,
} from "@/Pages/Core/FormPage";
import React, { useEffect, useMemo } from "react";

import CurrencyInput from "@/Components/CurrencyInput";
import DatetimePicker from "@/Components/DatetimePicker";
import DeliveryNoteLinkModel from "@/Pages/Inventory/DeliveryNotes/DeliveryNoteLinkModel";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import ItemVariantLinkModel from "@/Pages/Inventory/Items/ItemVariantLinkModel";
import Select from "@/Components/Select";
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
        readOnly: true,
        titleTrans: "sales.salesReturn.columns.item",
        required: true,
        width: 2,
        cell({ dataRow, setData, attributes }) {
          return (
            <ItemVariantLinkModel
              placeholder={t("sales.salesReturn.columns.item.placeholder")}
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
        titleTrans: "sales.salesReturn.columns.description",
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
      data.type == "replace" && {
        name: "source_warehouse",
        titleTrans: "sales.salesReturn.columns.source_warehouse",
        show: true,
        type: "text",
        width: 2,
        required: true,
        cell({ dataRow, data, setData, attributes }) {
          return (
            <WarehouseLinkModel
              disabled={!dataRow?.item}
              placeholder={t(
                "sales.salesReturn.columns.source_warehouse.placeholder",
              )}
              value={data}
              onValueChange={(val) => setData("source_warehouse", val)}
              {...attributes}
            />
          );
        },
      },
      {
        name: "target_warehouse",
        titleTrans: "sales.salesReturn.columns.target_warehouse",
        show: true,
        type: "text",
        width: 2,
        required: true,
        cell({ dataRow, data, setData, attributes }) {
          return (
            <WarehouseLinkModel
              disabled={!dataRow?.item}
              placeholder={t(
                "sales.salesReturn.columns.target_warehouse.placeholder",
              )}
              value={data}
              onValueChange={(val) => setData("target_warehouse", val)}
              {...attributes}
            />
          );
        },
      },
      {
        name: "quantity",
        titleTrans: "sales.salesReturn.columns.quantity",
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
        readOnly: true,
        titleTrans: "sales.salesReturn.columns.unit",
        required: true,
        cell({ data, setData, attributes, dataRow }) {
          return (
            <UnitLinkModel
              disabled={!dataRow?.item}
              placeholder={t("sales.salesReturn.columns.unit.placeholder")}
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
  }, [data]);

  useEffect(() => {
    if (!data.return_date) {
      setData("return_date", new Date().toISOString());
    }
  }, []);
  return (
    <>
      <FormPageContent value="detail" title={t("sales.salesReturn.detail")}>
        <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
          <FormInput
            name="return_date"
            label={t("sales.salesReturn.columns.return_date")}
            required
          >
            <DatetimePicker
              type="datetime"
              value={data?.return_date}
              onValueChange={(val) => {
                setData("return_date", val);
              }}
            />
          </FormInput>

          <FormInput
            label={t("sales.salesReturn.columns.delivery_note")}
            required={true}
            name="delivery_note"
          >
            <DeliveryNoteLinkModel
              placeholder={t(
                "sales.salesReturn.columns.delivery_note.placeholder",
              )}
              with={[
                "items",
                "items.sourceWarehouse",
                "items.item",
                "items.unit",
              ]}
              filters={{
                referenceable_type: "App\\Models\\Sales\\SalesOrder",
              }}
              value={data.delivery_note}
              onValueChange={(val) => {
                setData((prev) => {
                  return {
                    ...prev,
                    delivery_note: val,
                    items: val?.items.map((item) => {
                      return {
                        ...item,
                        id: generateRandom(8),
                        delivery_note_item_id: item?.id,
                        source_warehouse: null,
                        target_warehouse: item?.source_warehouse,
                        quantity: item?.remaining_quantity,
                      };
                    }),
                    external_note: val?.external_note,
                  };
                });
              }}
            />
          </FormInput>

          <FormInput
            label={t("sales.salesReturn.columns.type")}
            required
            name="type"
          >
            <Select
              placeholder={t("sales.salesReturn.columns.type.placeholder")}
              optionTrans="sales.salesReturn.columns.type.options"
              options={["return", "replace"]}
              value={data.type}
              onValueChange={(val) => {
                setData("type", val);
              }}
            />
          </FormInput>
        </div>
      </FormPageContent>
      <FormPageContent value="detail" title={t("sales.salesReturn.items")}>
        <FormPageContentTitle className="flex items-center justify-between gap-x-4">
          {t("sales.salesReturn.items")}
        </FormPageContentTitle>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <FormTable
            name="items"
            className="col-start-1 col-span-2"
            columns={itemColumns}
            value={data?.items ?? []}
            onValueChange={(v) => setData("items", v)}
          />
        </div>
      </FormPageContent>
      <FormPageContent
        value="detail"
        title={t("sales.salesReturn.columns.external_note")}
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
