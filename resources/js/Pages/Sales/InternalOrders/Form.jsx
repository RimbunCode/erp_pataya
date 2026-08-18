import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import React, { useCallback, useMemo, useRef } from "react";

import NumberInput from "@/Components/NumberInput";
import AssetServiceLinkModel from "@/Pages/Asset/Services/AssetServiceLinkModel";
import AssetServiceConsumedItemLinkModel from "@/Pages/Asset/Services/AssetServiceConsumedItemLinkModel";
import DatetimePicker from "@/Components/DatetimePicker";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import ItemBarcode from "@/Pages/Inventory/Items/ItemBarcode";
import ItemForm from "./ItemForm";
import ItemUnitLinkModel from "@/Pages/Inventory/Items/ItemUnitLinkModel";
import ItemVariantLinkModel from "@/Pages/Inventory/Items/ItemVariantLinkModel";
import { Textarea } from "@/Components/ui/textarea";
import WarehouseLinkModel from "@/Pages/Inventory/Warehouses/WarehouseLinkModel";
import { generateRandom } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Form() {
  const { t } = useLaravelReactI18n();
  const { data, setData, defaultData, disabled } = useFormPage(
    { date: new Date() },
    { trackDefaultValue: false },
  );
  const sourceWarehouseRef = useRef(data.source_warehouse);
  sourceWarehouseRef.current = data.source_warehouse;
  const handleBarcodeSelect = useCallback(
    (selected) => {
      const selectedItem = selected?.item ?? selected;
      const selectedUnit = selected?.unit ?? selected?.default_uom;
      if (!selectedItem || !selectedUnit) return;

      setData((prev) => {
        const items = [...(prev?.items ?? [])];
        const idx = items.findIndex(
          (row) =>
            row?.item?.id === selectedItem?.id &&
            row?.unit?.id === selectedUnit?.id,
        );
        if (idx >= 0) {
          const currentQty = items[idx]?.quantity ?? 0;
          items[idx] = { ...items[idx], quantity: currentQty + 1 };
        } else {
          items.push({
            id: generateRandom(5),
            item: selectedItem,
            unit: selectedUnit,
            quantity: 1,

            source_warehouse: prev?.source_warehouse,
          });
        }
        return { ...prev, items };
      });
    },
    [setData],
  );
  const itemColumns = useMemo(() => {
    return [
      {
        name: "item",
        titleTrans: "sales.internalOrder.columns.item",
        required: true,
        width: 2,
        cell({ dataRow, setData, attributes }) {
          return (
            <ItemVariantLinkModel
              placeholder={t("sales.internalOrder.columns.item.placeholder")}
              value={dataRow.item}
              onValueChange={(val) => {
                const defaultUnit = val?.default_uom;
                setData({
                  item: val,
                  unit: defaultUnit,
                  conversion_factor: defaultUnit?.conversion_factor,
                  source_warehouse:
                    dataRow.source_warehouse ?? sourceWarehouseRef.current,
                });
              }}
              {...attributes}
              fields={["is_stock_item"]}
              with={["defaultUom", "item"]}
            />
          );
        },
      },
      {
        name: "referenceable",
        titleTrans: "sales.internalOrder.columns.referenceable_asset_service",
        show: false,
        width: 3,
        cell({ data: value, setData, attributes }) {
          // Requirement 1, spec asset-service-internal-order: opsional, TIDAK
          // mempengaruhi baris ItemVariant biasa (default null/kosong).
          const type = value?.type;
          return (
            <div className="flex w-full gap-x-1">
              {type === "App\\Models\\Asset\\AssetServiceConsumedItem" ? (
                <AssetServiceConsumedItemLinkModel
                  value={value?.id ? { id: value.id } : null}
                  onValueChange={(val) =>
                    setData("referenceable", val ? { type, id: val.id } : null)
                  }
                  {...attributes}
                />
              ) : (
                <AssetServiceLinkModel
                  value={value?.id ? { id: value.id } : null}
                  onValueChange={(val) =>
                    setData(
                      "referenceable",
                      val
                        ? {
                            type: "App\\Models\\Asset\\AssetService",
                            id: val.id,
                          }
                        : null,
                    )
                  }
                  {...attributes}
                />
              )}
            </div>
          );
        },
      },
      {
        name: "description",
        titleTrans: "sales.internalOrder.columns.description",
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
        titleTrans: "sales.internalOrder.columns.source_warehouse",
        show: true,
        type: "text",
        width: 2,
        required: true,
        cell({ dataRow, data, setData, attributes }) {
          return (
            <WarehouseLinkModel
              disabled={!dataRow?.item}
              placeholder={t(
                "sales.internalOrder.columns.source_warehouse.placeholder",
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
        titleTrans: "sales.internalOrder.columns.quantity",
        required: true,
        type: "number",
        width: 1,
        cell({ dataRow, data, setData, attributes }) {
          return (
            <NumberInput
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
        titleTrans: "sales.internalOrder.columns.unit",
        required: true,
        cell({ data, setData, attributes, dataRow }) {
          return (
            <ItemUnitLinkModel
              disabled={!dataRow?.item}
              placeholder={t("sales.internalOrder.columns.unit.placeholder")}
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
  }, []);

  return (
    <>
      <FormPageContent value="detail" title={t("sales.internalOrder.detail")}>
        <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
          <FormInput
            label={t("sales.internalOrder.columns.date")}
            required
            name="date"
          >
            <DatetimePicker
              type="datetime"
              value={data.date}
              onValueChange={(val) => setData("date", val)}
            />
          </FormInput>
        </div>
      </FormPageContent>
      <FormPageContent value="detail" title={t("sales.internalOrder.items")}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <FormInput name="barcode" label={t("core.form.input_barcode.label")}>
            <ItemBarcode
              with={["item", "unit", "defaultUom"]}
              onSelect={handleBarcodeSelect}
            />
          </FormInput>
          <FormInput
            label={t("sales.internalOrder.columns.source_warehouse")}
            name="source_warehouse"
          >
            <WarehouseLinkModel
              placeholder={t(
                "sales.internalOrder.columns.source_warehouse.placeholder",
              )}
              value={data.source_warehouse}
              onValueChange={(val) => {
                setData((prev) => {
                  const newItems = prev.items.map((item) => {
                    return {
                      ...item,
                      source_warehouse: val,
                    };
                  });
                  return {
                    ...prev,
                    items: newItems,
                    source_warehouse: val,
                  };
                });
              }}
            />
          </FormInput>
          <FormTable
            name="IternalOrderItems"
            className="col-start-1 col-span-2"
            classNameDialog="max-w-(--breakpoint-lg)! w-full!"
            form={<ItemForm />}
            readOnly={disabled}
            columns={itemColumns}
            value={data?.items ?? []}
            onValueChange={(v) => setData("items", v)}
          />
        </div>
      </FormPageContent>
      <FormPageContent
        value="detail"
        title={t("sales.internalOrder.columns.external_note")}
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
