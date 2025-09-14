import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import React, { useEffect, useMemo } from "react";

import BranchLinkModel from "@/Pages/Settings/Branches/BranchLinkModel";
import CurrencyInput from "@/Components/CurrencyInput";
import CurrencyLinkModel from "@/Pages/Core/CurrencyLinkModel";
import CustomerLinkModel from "@/Pages/Sales/Customers/CustomerLinkModel";
import DatetimePicker from "@/Components/DatetimePicker";
import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import ItemVariantLinkModel from "@/Pages/Inventory/Items/ItemVariantLinkModel";
import SalesOrderLinkModel from "./SalesOrderLinkModel";
import TaxLinkModel from "@/Pages/Finances/Taxes/TaxLinkModel";
import { Textarea } from "@/Components/ui/textarea";
import UnitLinkModel from "@/Pages/Inventory/Units/UnitLinkModel";
import WarehouseLinkModel from "@/Pages/Inventory/Warehouses/WarehouseLinkModel";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Form() {
  const { t } = useLaravelReactI18n();
  const { data, setData, disabled } = useFormPage();
  const itemColumns = useMemo(() => {
    return [
      {
        name: "item",
        titleTrans: "sales.salesOrder.columns.item",
        required: true,
        width: 2,
        cell({ dataRow, setData, attributes }) {
          return (
            <ItemVariantLinkModel
              placeholder={t("sales.salesOrder.columns.item.placeholder")}
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
        titleTrans: "sales.salesOrder.columns.description",
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
        titleTrans: "sales.salesOrder.columns.source_warehouse",
        show: true,
        type: "text",
        width: 2,
        required: true,
        cell({ dataRow, data, setData, attributes }) {
          return (
            <WarehouseLinkModel
              disabled={!dataRow?.item}
              placeholder={t(
                "sales.salesOrder.columns.source_warehouse.placeholder",
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
        titleTrans: "sales.salesOrder.columns.quantity",
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
        titleTrans: "sales.salesOrder.columns.unit",
        required: true,
        cell({ data, setData, attributes, dataRow }) {
          return (
            <UnitLinkModel
              disabled={!dataRow?.item}
              placeholder={t("sales.salesOrder.columns.unit.placeholder")}
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
        name: "tax",
        titleTrans: "sales.salesOrder.columns.tax",
        required: true,
        width: 1,
        cell({ data, setData, attributes, dataRow }) {
          return (
            <TaxLinkModel
              disabled={!dataRow?.item}
              placeholder={t("sales.salesOrder.columns.tax.placeholder")}
              value={data}
              onValueChange={(val) => {
                setData("tax", val);
              }}
              {...attributes}
            />
          );
        },
      },
      {
        name: "price",
        titleTrans: "sales.salesOrder.columns.price",
        required: true,
        width: 1,
        cell({ data, setData, attributes, dataRow }) {
          return (
            <CurrencyInput
              currencyCode="default"
              decimalScale={2}
              disabled={!dataRow?.item}
              value={data}
              onValueChange={(val) => {
                setData("price", val);
              }}
              {...attributes}
            />
          );
        },
      },
    ];
  }, []);
  useEffect(() => {
    if (!data.date) {
      setData("date", new Date());
    }
  }, []);
  return (
    <>
      <FormPageContent value="detail" title={t("sales.salesOrder.detail")}>
        <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
          <FormInput
            label={t("sales.salesOrder.columns.date")}
            required
            name="date"
          >
            <DatetimePicker
              type="datetime"
              value={data.date}
              onValueChange={(val) => setData("date", val)}
            />
          </FormInput>
          <FormCheckbox
            checked={data.is_rent}
            onCheckedChange={(val) => setData("is_rent", val)}
            className="pt-4"
          >
            {t("sales.salesOrder.for_rental")}
          </FormCheckbox>

          {data.is_rent && (
            <FormInput
              required
              label={t("sales.salesOrder.rental_date")}
              name="rental_date"
            >
              <DatetimePicker
                type="daterange"
                value={data.rental_date}
                onValueChange={(range) => setData("rental_date", range)}
              />
            </FormInput>
          )}

          <FormInput
            className="col-start-1"
            label={t("sales.salesOrder.customer")}
            required={true}
            name="customer"
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
            label={t("sales.salesOrder.branch")}
            required
            name="customer_branch"
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
          <FormInput
            className="col-start-1"
            label={t("sales.salesOrder.currency")}
            name="currency"
          >
            <CurrencyLinkModel
              placeholder={t("sales.salesOrder.currency.placeholder")}
              value={data.currency}
              onValueChange={(val) => {
                setData("currency", val);
              }}
            />
          </FormInput>

          <FormInput
            label={t("sales.salesOrder.exchange_rate")}
            name="exchange_rate"
          >
            <CurrencyInput
              disabled={!data.currency}
              className="text-left"
              decimalScale={2}
              value={data.exchange_rate}
              onValueChange={(value) => {
                setData("exchange_rate", value);
              }}
            />
          </FormInput>
          <FormInput
            className="col-span-2 col-start-1"
            label={t("sales.salesOrder.columns.reference_so")}
            name="reference_so"
          >
            <SalesOrderLinkModel
              placeholder={t(
                "sales.salesOrder.columns.reference_so.placeholder",
              )}
              value={data.reference_so}
              onValueChange={(val) => {
                setData("reference_so", val);
              }}
            />
          </FormInput>
        </div>
      </FormPageContent>
      <FormPageContent value="detail" title={t("sales.salesOrder.items")}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <FormInput
            label={t("sales.salesOrder.columns.source_warehouse")}
            name="source_warehouse"
          >
            <WarehouseLinkModel
              placeholder={t(
                "sales.salesOrder.columns.source_warehouse.placeholder",
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
            className="col-start-1 col-span-2"
            readOnly={disabled}
            columns={itemColumns}
            value={data?.items ?? []}
            onValueChange={(v) => setData("items", v)}
          />
        </div>
      </FormPageContent>
      <FormPageContent
        value="detail"
        title={t("sales.salesOrder.columns.external_note")}
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
      {/* {(data.status ?? "draft") != "draft" && (
        <FormPageContent
          value="connections"
          title={t("core.form.connections")}
        ></FormPageContent>
      )} */}
    </>
  );
}
