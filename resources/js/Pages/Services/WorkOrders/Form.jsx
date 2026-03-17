import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import React, { useCallback, useMemo } from "react";

import BranchLinkModel from "@/Pages/Settings/Branches/BranchLinkModel";
import CurrencyInput from "@/Components/CurrencyInput";
import CustomerLinkModel from "@/Pages/Sales/Customers/CustomerLinkModel";
import DatetimePicker from "@/Components/DatetimePicker";
import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import ItemBarcode from "@/Pages/Inventory/Items/ItemBarcode";
import ItemForm from "./ItemForm";
import ItemVariantLinkModel from "@/Pages/Inventory/Items/ItemVariantLinkModel";
import { Textarea } from "@/Components/ui/textarea";
import UnitLinkModel from "@/Pages/Inventory/Units/UnitLinkModel";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Form() {
  const { t } = useLaravelReactI18n();
  const { dataBefore, defaultData, data, setData, disabled } = useFormPage(
    {
      date: new Date(),
    },
    {
      trackDefaultValue: false,
    },
  );
  const itemColumns = useMemo(() => {
    return [
      {
        name: "item",
        titleTrans: "service.workOrder.columns.item",
        required: true,
        width: 3,
        unique: true,
        cell({ data, setData, attributes }) {
          return (
            <ItemVariantLinkModel
              placeholder={t("service.workOrder.columns.item.placeholder")}
              value={data}
              onValueChange={(val) => {
                setData({
                  item: val,
                  unit: val?.default_unit,
                  alternative: null,
                });
              }}
              {...attributes}
              filters={{
                type: {
                  not: "vehicle",
                },
              }}
              with={["defaultUnit", "item"]}
            />
          );
        },
      },
      {
        name: "description",
        titleTrans: "service.workOrder.columns.description",
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
        name: "quantity",
        titleTrans: "service.workOrder.columns.quantity",
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
        titleTrans: "service.workOrder.columns.unit",
        required: true,
        cell({ data, setData, attributes, dataRow }) {
          return (
            <UnitLinkModel
              disabled={!dataRow?.item}
              placeholder={t("service.workOrder.columns.unit.placeholder")}
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
        name: "alternative",
        titleTrans: "service.workOrder.columns.alternative",
        width: 3,
        cell({ data, setData, attributes, dataRow }) {
          return (
            <ItemVariantLinkModel
              disabled={
                !(
                  dataRow?.item?.allow_alternative_item ??
                  dataRow?.item?.item?.allow_alternative_item
                )
              }
              placeholder={t(
                "service.workOrder.columns.alternative.placeholder",
              )}
              value={data}
              onValueChange={(val) => {
                setData("alternative", val);
              }}
              disabledAddButton
              {...attributes}
              filters={{
                type: {
                  not: "vehicle",
                },
                or: {
                  "raw(item_alternatives.item_id)": dataRow?.item?.id,
                  and: {
                    "raw(item_alternatives.alternative_item_id)":
                      dataRow?.item?.id,
                    "raw(item_alternatives.two_way)": true,
                  },
                },
              }}
              joins={{
                item_alternatives: {
                  on: {
                    or: {
                      "and[0]": {
                        "item_alternatives.item_id": dataRow?.item?.id,
                        "item_alternatives.alternative_item_id": {
                          column: "item_variants.id",
                        },
                      },
                      "and[1]": {
                        "item_alternatives.alternative_item_id":
                          dataRow?.item?.id,
                        "item_alternatives.item_id": {
                          column: "item_variants.id",
                        },
                        "item_alternatives.two_way": true,
                      },
                    },
                  },
                },
              }}
            />
          );
        },
      },
    ];
  }, []);

  const handleBarcodeSelect = useCallback(
    (selected) => {
      const selectedItem = selected?.item ?? selected;
      const selectedUnit = selected?.unit ?? selected?.default_unit;
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
            item: selectedItem,
            unit: selectedUnit,
            quantity: 1,
          });
        }

        return {
          ...prev,
          items,
        };
      });
    },
    [setData],
  );
  return (
    <>
      <FormPageContent value="detail" title={t("service.workOrder.detail")}>
        <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
          <FormInput
            label={t("service.workOrder.columns.date")}
            required
            name="date"
          >
            <DatetimePicker
              type="datetime"
              value={data.date}
              onValueChange={(val) => {
                console.log(val);
                setData("date", val);
              }}
            />
          </FormInput>
          <FormCheckbox
            checked={data.for_internal}
            onCheckedChange={(val) => setData("for_internal", val)}
            className="pt-4"
          >
            {t("service.workOrder.columns.for_internal")}
          </FormCheckbox>
          <FormInput
            className="col-start-1"
            label={t("service.workOrder.columns.customer")}
            required={!data.for_internal}
            name="customer"
          >
            <CustomerLinkModel
              disabled={data.for_internal}
              with={["branches"]}
              valueBefore={dataBefore.customer}
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
            label={t(
              data.for_internal
                ? "service.workOrder.columns.internal_branch"
                : "service.workOrder.columns.customer_branch",
            )}
            required
            name="customer_branch"
          >
            <BranchLinkModel
              disabled={!(data.for_internal || data.customer)}
              valueBefore={dataBefore.customer_branch}
              value={data.customer_branch}
              onValueChange={(val) => setData("customer_branch", val)}
              disabledNavigation={!data.for_internal}
              filters={{
                branchable_type: data.for_internal
                  ? null
                  : "App\\Models\\Sales\\Customer",
                branchable_id: data.for_internal
                  ? null
                  : (data.customer?.id ?? null),
              }}
              defaultValueForm={{
                branchable_type: data.for_internal
                  ? null
                  : "App\\Models\\Sales\\Customer",
                branchable_id: data.for_internal
                  ? null
                  : (data.customer?.id ?? null),
              }}
            />
          </FormInput>

          <FormInput
            className="col-span-2 col-start-1"
            label={t("service.workOrder.columns.item_service")}
            required
            name="item_service"
          >
            <ItemVariantLinkModel
              placeholder={t(
                "service.workOrder.columns.item_service.placeholder",
              )}
              valueBefore={dataBefore.item_service}
              value={data.item_service}
              onValueChange={(val) => {
                setData("item_service", val);
              }}
              filters={{
                type: "vehicle",
              }}
              with={["defaultUnit", "category"]}
            />
          </FormInput>
          {defaultData?.started_at && (
            <FormInput
              disabled
              label={t("service.workOrder.columns.started_at")}
            >
              <DatetimePicker type="datetime" value={data.started_at} />
            </FormInput>
          )}
          {defaultData?.completed_at && (
            <FormInput
              disabled
              label={t("service.workOrder.columns.completed_at")}
            >
              <DatetimePicker type="datetime" value={data.completed_at} />
            </FormInput>
          )}
        </div>
      </FormPageContent>
      <FormPageContent value="detail" title={t("service.workOrder.items")}>
        <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
          <FormInput name="barcode" label={t("core.form.input_barcode.label")}>
            <ItemBarcode
              filters={{
                item: {
                  type: { not: "vehicle" },
                },
              }}
              with={["item", "unit"]}
              onSelect={handleBarcodeSelect}
            />
          </FormInput>
          <FormTable
            name="WorkOrderItems"
            className="col-start-1  col-span-full"
            readOnly={disabled}
            columns={itemColumns}
            value={data?.items ?? []}
            onValueChange={(v) => setData("items", v)}
            form={<ItemForm />}
          />
        </div>
      </FormPageContent>
      <FormPageContent
        value="detail"
        title={t("service.workOrder.columns.external_note")}
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
