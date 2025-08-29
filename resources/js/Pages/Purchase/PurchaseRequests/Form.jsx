import CurrencyInput from "@/Components/CurrencyInput";
import DatetimePicker from "@/Components/DatetimePicker";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import { Textarea } from "@/Components/ui/textarea";
import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import ItemVariantLinkModel from "@/Pages/Inventory/Items/ItemVariantLinkModel";
import UnitLinkModel from "@/Pages/Inventory/Units/UnitLinkModel";
import { useLaravelReactI18n } from "laravel-react-i18n";
import React from "react";
import { useMemo } from "react";
import ItemForm from "./ItemForm";

function Form() {
  const { t } = useLaravelReactI18n();
  const { data, setData, disabled } = useFormPage();
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
                  alternative: null,
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
      {
        name: "alternative",
        titleTrans: "purchase.purchaseRequest.columns.alternative",
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
                "purchase.purchaseRequest.columns.alternative.placeholder",
              )}
              value={data}
              onValueChange={(val) => {
                setData("alternative", val);
              }}
              disabledAddButton
              {...attributes}
              filters={{
                category: {
                  type: {
                    in: ["service", "stock"],
                  },
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
                  const items = data?.items?.map((item) => {
                    return {
                      ...item,
                      required_date: val,
                    };
                  });
                  setData({
                    required_date: val,
                    items,
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
      >
        <FormTable
          readOnly={disabled}
          columns={itemColumns}
          value={data?.items ?? []}
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
