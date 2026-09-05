import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import React, { useCallback, useMemo, useRef } from "react";

import NumberInput from "@/Components/NumberInput";
import DatetimePicker from "@/Components/DatetimePicker";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import ItemBarcode from "@/Pages/Inventory/Items/ItemBarcode";
import ItemForm from "./ItemForm";
import ItemUnitLinkModel from "@/Pages/Inventory/Items/ItemUnitLinkModel";
import ItemVariantLinkModel from "@/Pages/Inventory/Items/ItemVariantLinkModel";
import LinkModel from "@/Components/LinkModel";
import { Textarea } from "@/Components/ui/textarea";
import WarehouseLinkModel from "@/Pages/Inventory/Warehouses/WarehouseLinkModel";
import { generateRandom } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";

const ASSET_SERVICE_CLASS = "App\\Models\\Asset\\AssetService";
const ASSET_SERVICE_CONSUMED_ITEM_CLASS =
  "App\\Models\\Asset\\AssetServiceConsumedItem";

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
    // Requirement 4.1, spec asset-service-billing-reference-flow: daftar id
    // ItemVariant dari consumedItems milik AssetService header — dipakai utk
    // filter kolom Item. Header `data.referenceable` sudah dimuat penuh lewat
    // controller create() (Eloquent::load(), bukan /model), tidak perlu
    // request tambahan.
    const consumedItemVariantIds =
      data.referenceable_type === ASSET_SERVICE_CLASS
        ? (data.referenceable?.consumed_items ?? [])
            .map((ci) => ci.item?.id)
            .filter(Boolean)
        : [];

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
              disabled={dataRow?.assetServiceLocked}
              filters={
                data.referenceable_type === ASSET_SERVICE_CLASS
                  ? {
                      or: {
                        "item.category.type": "service",
                        id: { in: consumedItemVariantIds },
                      },
                    }
                  : undefined
              }
              onValueChange={(val) => {
                const defaultUnit = val?.default_uom;
                const rowPatch = {
                  item: val,
                  unit: defaultUnit,
                  conversion_factor: defaultUnit?.conversion_factor,
                  source_warehouse:
                    dataRow.source_warehouse ?? sourceWarehouseRef.current,
                };
                // Requirement 6, spec asset-service-billing-reference-flow:
                // auto-link baris ke AssetServiceConsumedItem (match persis
                // via item_id) atau AssetService langsung (item kategori
                // Jasa), lock Item+Quantity utk baris part (Requirement 5).
                if (data.referenceable_type === ASSET_SERVICE_CLASS) {
                  const matched = (
                    data.referenceable?.consumed_items ?? []
                  ).find((ci) => ci.item?.id === val?.id);
                  if (matched) {
                    rowPatch.referenceable = {
                      type: ASSET_SERVICE_CONSUMED_ITEM_CLASS,
                      id: matched.id,
                    };
                    rowPatch.quantity = matched.quantity;
                    rowPatch.unit = matched.item_unit;
                    rowPatch.conversion_factor =
                      matched.item_unit?.conversion_factor;
                    rowPatch.assetServiceLocked = true;
                  } else {
                    rowPatch.assetServiceLocked = false;
                    if (val?.item?.category?.type === "service") {
                      rowPatch.referenceable = {
                        type: ASSET_SERVICE_CLASS,
                        id: data.referenceable_id,
                      };
                    }
                  }
                }
                setData(rowPatch);
              }}
              {...attributes}
              fields={["is_stock_item"]}
              with={["defaultUom", "item", "item.category"]}
            />
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
              disabled={!dataRow?.item || !dataRow?.item?.is_stock_item}
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
              disabled={!dataRow?.item || dataRow?.assetServiceLocked}
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
  }, [data.referenceable_type, data.referenceable_id, data.referenceable]);

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
          {data.referenceable && (
            <FormInput
              name="date"
              className="pointer-events-auto!"
              label={t("sales.internalOrder.columns.reference_to")}
              readOnly
            >
              <LinkModel
                disabledAddButton
                model={data.referenceable_type}
                value={data.referenceable}
              />
            </FormInput>
          )}
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
