import {
  FormPageContent,
  FormPageContentTitle,
  useFormPage,
} from "@/Pages/Core/FormPage";
import React, { useCallback, useEffect, useMemo } from "react";
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
import PaymentTermLinkModel from "@/Pages/Finances/PaymentTerms/PaymentTermLinkModel";
import PaymentMethodLinkModel from "@/Pages/Finances/PaymentMethods/PaymentMethodLinkModel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Components/ui/select";
import { generateRandom } from "@/lib/utils";
import { usePage } from "@inertiajs/react";
import SelectModel, { loadFromModel } from "@/Components/SelectModel";

export default function Form() {
  const { t } = useLaravelReactI18n();
  const { data, setData, disabled } = useFormPage();
  const loadFrom = usePage().props.loadFrom;

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
      mergeItems(data.value, data.model);
    };
    fetchData().catch(console.error);
  }, []);
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
        cell({ data: price, setData, attributes, dataRow }) {
          return (
            <CurrencyInput
              decimalScale={2}
              currencyCode={data?.currency?.code}
              disabled={!dataRow?.item}
              value={price}
              onValueChange={(val) => {
                setData("price", val);
              }}
              {...attributes}
            />
          );
        },
      },
    ];
  }, [data]);

  const paymentScheduleColumns = useMemo(() => {
    return [
      {
        name: "payment_term",
        titleTrans: "sales.salesOrder.columns.payment_term",
        required: true,
        cell({ data: paymentTerm, setData, attributes }) {
          return (
            <PaymentTermLinkModel
              placeholder={t(
                "sales.salesOrder.columns.payment_term.placeholder",
              )}
              value={paymentTerm}
              onValueChange={(val) => {
                const due_date = new Date(data?.date);
                console.log(due_date, data?.date);
                const payment_amount =
                  data?.amount * (val?.invoice_portion / 100);
                switch (val?.due_date_based_on) {
                  case "days_after_invoice_date": {
                    due_date.setDate(
                      due_date.getDate() + (val?.credit_period ?? 0),
                    );
                    break;
                  }
                  case "weeks_after_invoice_week": {
                    due_date.setDate(
                      due_date.getDate() + (val?.credit_period ?? 0) * 7,
                    );
                    break;
                  }
                  case "months_after_invoice_month": {
                    due_date.setMonth(
                      due_date.getMonth() + (val?.credit_period ?? 0),
                    );
                    break;
                  }
                }
                console.log(due_date);
                setData({
                  payment_term: val,
                  due_date,
                  description: val?.description,
                  invoice_portion: val?.invoice_portion,
                  discount_type: val?.discount_type,
                  discount: val?.discount,
                  payment_method: val?.payment_method,
                  payment_amount,
                  outstanding_amount: payment_amount,
                });
              }}
              {...attributes}
            />
          );
        },
      },
      {
        name: "due_date",
        titleTrans: "sales.salesOrder.columns.due_date",
        required: true,
        cell({ data, setData, attributes }) {
          return (
            <DatetimePicker
              type="datetime"
              value={data}
              onValueChange={(val) => setData("due_date", val)}
              {...attributes}
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
        name: "invoice_portion",
        titleTrans: "sales.salesOrder.columns.invoice_portion",
        required: true,
        width: 1,
        cell({ data, setData, attributes }) {
          return (
            <CurrencyInput
              decimalScale={2}
              suffix="%"
              value={data}
              onValueChange={(val) => {
                setData("invoice_portion", val);
              }}
              {...attributes}
            />
          );
        },
      },
      {
        name: "payment_amount",
        titleTrans: "sales.salesOrder.columns.payment_amount",
        required: true,
        width: 1,
        cell({ data: payment_amount, setData, attributes }) {
          return (
            <CurrencyInput
              decimalScale={2}
              currencyCode={data?.currency?.code}
              value={payment_amount}
              onValueChange={(val) => {
                setData("payment_amount", val);
              }}
              {...attributes}
            />
          );
        },
      },
      {
        name: "payment_method",
        titleTrans: "sales.salesOrder.columns.payment_method",
        width: 1,
        cell({ data, setData, attributes }) {
          return (
            <PaymentMethodLinkModel
              value={data}
              onValueChange={(val) => setData("payment_method", val)}
              placeholder={t(
                "finances.paymentTerm.columns.payment_method.placeholder",
              )}
              {...attributes}
            />
          );
        },
      },
      {
        name: "discount_type",
        titleTrans: "sales.salesOrder.columns.discount_type",
        width: 1,
        cell({ data, setData, attributes }) {
          return (
            <Select
              value={data}
              onValueChange={(val) => setData("discount_type", val)}
              {...attributes}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t(
                    "sales.salesOrder.columns.discount_type.placeholder",
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">
                  {t(
                    "sales.salesOrder.columns.discount_type.options.percentage",
                  )}
                </SelectItem>
                <SelectItem value="amount">
                  {t("sales.salesOrder.columns.discount_type.options.amount")}
                </SelectItem>
              </SelectContent>
            </Select>
          );
        },
      },
      {
        name: "discount",
        titleTrans: "sales.salesOrder.columns.discount",
        width: 1,
        cell({ data: discount, dataRow, setData, attributes }) {
          return (
            <CurrencyInput
              className="text-left"
              value={discount}
              currencyCode={
                dataRow.discount_type == "percentage"
                  ? undefined
                  : data?.currency?.code
              }
              onValueChange={(value) => setData("discount", value)}
              decimalsLimit={2}
              suffix={dataRow.discount_type == "percentage" ? "%" : ""}
              min={dataRow.discount_type == "percentage" && 0}
              max={dataRow.discount_type == "percentage" && 100}
              {...attributes}
            />
          );
        },
      },
      {
        name: "outstanding_amount",
        titleTrans: "sales.salesOrder.columns.outstanding_amount",
        readOnly: true,
        width: 1,
        cell({ data, setData, attributes }) {
          return (
            <CurrencyInput
              decimalScale={2}
              currencyCode={data?.currency?.code}
              value={data}
              onValueChange={(val) => setData("outstanding_amount", val)}
              {...attributes}
            />
          );
        },
      },
    ];
  }, [data]);
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
            name="date"
            label={t("sales.salesOrder.columns.date")}
            required
          >
            <DatetimePicker
              type="datetime"
              value={data?.date}
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
      <FormPageContent
        value="detail"
        title={t("sales.salesOrder.items")}
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
                      columns: ["work_order", "item", "quantity", "unit"],
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
        <FormPageContentTitle className="flex items-center justify-between gap-x-4">
          {t("sales.salesOrder.items")}
          {(!data.status || data.status == "draft") && (
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
                      columns: ["work_order", "item", "quantity", "unit"],
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
          )}
        </FormPageContentTitle>
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
            name="items"
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
      <FormPageContent
        value="terms"
        title={t("sales.salesOrder.columns.terms")}
      >
        <div className="px-1 py-1">
          <FormTable
            name="paymentSchedules"
            className="col-start-1 col-span-2"
            readOnly={disabled}
            columns={paymentScheduleColumns}
            value={data?.payment_schedules ?? []}
            onValueChange={(v) => setData("payment_schedules", v)}
          />
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
