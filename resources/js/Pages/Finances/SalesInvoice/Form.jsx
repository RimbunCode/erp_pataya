import {
  FormPageContent,
  FormPageContentTitle,
  useFormPage,
} from "@/Pages/Core/FormPage";
import React, { useMemo } from "react";

import BranchLinkModel from "@/Pages/Settings/Branches/BranchLinkModel";
import CurrencyInput from "@/Components/CurrencyInput";
import CurrencyLinkModel from "@/Pages/Core/CurrencyLinkModel";
import CustomerLinkModel from "@/Pages/Sales/Customers/CustomerLinkModel";
import DatetimePicker from "@/Components/DatetimePicker";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import ItemVariantLinkModel from "@/Pages/Inventory/Items/ItemVariantLinkModel";
import PaymentMethodLinkModel from "@/Pages/Finances/PaymentMethods/PaymentMethodLinkModel";
import PaymentTermLinkModel from "@/Pages/Finances/PaymentTerms/PaymentTermLinkModel";
import SalesOrderLinkModel from "@/Pages/Sales/SalesOrders/SalesOrderLinkModel";
import Select from "@/Components/Select";
import TaxLinkModel from "@/Pages/Finances/Taxes/TaxLinkModel";
import { Textarea } from "@/Components/ui/textarea";
import UnitLinkModel from "@/Pages/Inventory/Units/UnitLinkModel";
import WarehouseLinkModel from "@/Pages/Inventory/Warehouses/WarehouseLinkModel";
import { calculateArray } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

export default function Form() {
  const { t } = useLaravelReactI18n();
  const { data, setData, disabled } = useFormPage();
  const { default_currency_id } = usePage().props.preferences;
  const amount = useMemo(() => {
    return calculateArray(data.items, "amount", "+");
  }, [data.items]);

  const basic_amount = useMemo(() => {
    return calculateArray(data.items, "basic_amount", "+");
  }, [data.items]);

  const tax_amount = useMemo(() => {
    return calculateArray(data.items, "tax_amount", "+");
  }, [data.items]);

  const itemColumns = useMemo(() => {
    return [
      {
        name: "item",
        titleTrans: "finances.salesInvoice.columns.item",
        required: true,
        width: 2,
        cell({ dataRow, setData, attributes }) {
          return (
            <ItemVariantLinkModel
              placeholder={t("finances.salesInvoice.columns.item.placeholder")}
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
        titleTrans: "finances.salesInvoice.columns.description",
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
        titleTrans: "finances.salesInvoice.columns.source_warehouse",
        show: true,
        type: "text",
        width: 2,
        required: true,
        cell({ dataRow, data, setData, attributes }) {
          return (
            <WarehouseLinkModel
              disabled={!dataRow?.item}
              placeholder={t(
                "finances.salesInvoice.columns.source_warehouse.placeholder",
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
        titleTrans: "finances.salesInvoice.columns.quantity",
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
        titleTrans: "finances.salesInvoice.columns.unit",
        required: true,
        cell({ data, setData, attributes, dataRow }) {
          return (
            <UnitLinkModel
              disabled={!dataRow?.item}
              placeholder={t("finances.salesInvoice.columns.unit.placeholder")}
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
        titleTrans: "finances.salesInvoice.columns.tax",
        required: true,
        width: 1,
        cell({ data, setData, attributes, dataRow }) {
          return (
            <TaxLinkModel
              disabled={!dataRow?.item}
              placeholder={t("finances.salesInvoice.columns.tax.placeholder")}
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
        titleTrans: "finances.salesInvoice.columns.price",
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
        titleTrans: "finances.salesInvoice.columns.payment_term",
        show: true,
        cell({ data: paymentTerm, setData, attributes }) {
          return (
            <PaymentTermLinkModel
              placeholder={t(
                "finances.salesInvoice.columns.payment_term.placeholder",
              )}
              value={paymentTerm}
              onValueChange={(val) => {
                const due_date = new Date(data?.date);
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
                setData({
                  payment_term: val,
                  due_date,
                  description: val?.description,
                  invoice_portion: val?.invoice_portion,
                  discount_type: val?.discount_type,
                  discount: val?.discount,
                  payment_method: val?.payment_method,
                });
              }}
              {...attributes}
            />
          );
        },
      },
      {
        name: "due_date",
        titleTrans: "finances.salesInvoice.columns.due_date",
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
        titleTrans: "finances.salesInvoice.columns.description",
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
        titleTrans: "finances.salesInvoice.columns.invoice_portion",
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
        titleTrans: "finances.salesInvoice.columns.payment_amount",
        required: true,
        readOnly: true,
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
        titleTrans: "finances.salesInvoice.columns.payment_method",
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
        titleTrans: "finances.salesInvoice.columns.discount_type",
        width: 1,
        cell({ data, setData, attributes }) {
          return (
            <Select
              value={data}
              onValueChange={(val) => setData("discount_type", val)}
              {...attributes}
              placeholder={t(
                "finances.salesInvoice.columns.discount_type.placeholder",
              )}
              optionTrans="finances.salesInvoice.columns.discount_type.options"
              options={["percentage", "amount"]}
            />
          );
        },
      },
      {
        name: "discount",
        titleTrans: "finances.salesInvoice.columns.discount",
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
        titleTrans: "finances.salesInvoice.columns.outstanding_amount",
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

  return (
    <>
      <FormPageContent value="detail" title={t("finances.salesInvoice.detail")}>
        <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
          <FormInput
            name="date"
            label={t("finances.salesInvoice.columns.date")}
            required
          >
            <DatetimePicker
              type="datetime"
              value={data?.date}
              onValueChange={(val) => {
                setData("date", val);
              }}
            />
          </FormInput>
          <FormInput
            label={t("finances.salesInvoice.columns.sales_order")}
            name="sales_order"
          >
            <SalesOrderLinkModel
              filters={{
                date: {
                  "<=": data?.date ?? new Date().toISOString(),
                },
                status: {
                  in: ["to_deliver_and_bill", "to_bill"],
                },
              }}
              placeholder={t(
                "finances.salesInvoice.columns.sales_order.placeholder",
              )}
              with={[
                "items",
                "customer",
                "customer_branch",
                "currency",
                "items.item",
                "items.tax",
                "items.unit",
                "items.sourceWarehouse",
                "paymentSchedules",
                "paymentSchedules.paymentTerm",
                "paymentSchedules.paymentMethod",
              ]}
              value={data.sales_order}
              onValueChange={(val) => {
                setData((prev) => {
                  return {
                    ...prev,
                    sales_order: val,
                    customer: val?.customer,
                    customer_branch: val?.customer_branch,
                    currency: val?.currency,
                    items: val?.items,
                    paymentSchedules: val?.paymentSchedules,
                    amount: val?.amount,
                    discount_on: val?.discount_on,
                    discount_rate: val?.discount_rate,
                    discount_amount: val?.discount_amount,
                    exchange_rate: val?.exchange_rate,
                    external_note: val?.external_note,
                  };
                });
              }}
            />
          </FormInput>

          <FormInput
            className="col-start-1"
            label={t("finances.salesInvoice.customer")}
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
            label={t("finances.salesInvoice.branch")}
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
          <FormInput
            className="col-start-1"
            label={t("finances.salesInvoice.currency")}
            name="currency"
            readOnly
          >
            <CurrencyLinkModel
              placeholder={t("finances.salesInvoice.currency.placeholder")}
              value={data.currency}
              onValueChange={(val) => {
                setData("currency", val);
              }}
            />
          </FormInput>

          <FormInput
            label={t("finances.salesInvoice.exchange_rate")}
            name="exchange_rate"
            readOnly
          >
            <CurrencyInput
              disabled={
                !(
                  data?.currency?.code &&
                  data?.currency?.code !== default_currency_id
                )
              }
              className="text-left"
              decimalScale={2}
              value={data.exchange_rate}
              onValueChange={(value) => {
                setData("exchange_rate", value);
              }}
            />
          </FormInput>
        </div>
      </FormPageContent>
      <FormPageContent value="detail" title={t("finances.salesInvoice.items")}>
        <FormPageContentTitle className="flex items-center justify-between gap-x-4">
          {t("finances.salesInvoice.items")}
        </FormPageContentTitle>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <FormTable
            name="items"
            className="col-start-1 col-span-2"
            disabled={true}
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
                amount: amount + rateAmount,
              };
            }}
          />
          {data?.currency?.code &&
            data?.currency?.code !== default_currency_id && (
              <FormInput
                readOnly
                label={`${t("finances.salesInvoice.columns.basic_amount")} (${default_currency_id.toUpperCase()})`}
              >
                <CurrencyInput
                  className="text-right"
                  value={basic_amount * (data?.exchange_rate ?? 1)}
                  currencyCode="default"
                ></CurrencyInput>
              </FormInput>
            )}
          <FormInput
            readOnly
            label={`${t("finances.salesInvoice.columns.basic_amount")} (${(data?.currency?.code ?? default_currency_id).toUpperCase()})`}
            className="col-start-2"
          >
            <CurrencyInput
              decimalScale={2}
              className="text-right"
              value={basic_amount}
              currencyCode={data?.currency?.code ?? "default"}
            ></CurrencyInput>
          </FormInput>
          {data?.currency?.code &&
            data?.currency?.code !== default_currency_id && (
              <FormInput
                readOnly
                label={`${t("finances.salesInvoice.columns.tax_amount")} (${default_currency_id.toUpperCase()})`}
              >
                <CurrencyInput
                  className="text-right"
                  value={tax_amount * (data?.exchange_rate ?? 1)}
                  currencyCode="default"
                ></CurrencyInput>
              </FormInput>
            )}
          <FormInput
            readOnly
            label={`${t("finances.salesInvoice.columns.tax_amount")} (${(data?.currency?.code ?? default_currency_id).toUpperCase()})`}
            className="col-start-2"
          >
            <CurrencyInput
              decimalScale={2}
              className="text-right"
              value={tax_amount}
              currencyCode={data?.currency?.code ?? "default"}
            ></CurrencyInput>
          </FormInput>
          {data?.currency?.code &&
            data?.currency?.code !== default_currency_id && (
              <FormInput
                readOnly
                label={`${t("finances.salesInvoice.columns.total")} (${default_currency_id.toUpperCase()})`}
              >
                <CurrencyInput
                  className="text-right"
                  value={amount * (data?.exchange_rate ?? 1)}
                  currencyCode="default"
                ></CurrencyInput>
              </FormInput>
            )}
          <FormInput
            readOnly
            label={`${t("finances.salesInvoice.columns.total")} (${(data?.currency?.code ?? default_currency_id).toUpperCase()})`}
            className="col-start-2"
          >
            <CurrencyInput
              className="text-right"
              decimalScale={2}
              value={amount}
              currencyCode={data?.currency?.code ?? "default"}
            ></CurrencyInput>
          </FormInput>
        </div>
      </FormPageContent>
      <FormPageContent
        value="detail"
        title={t("finances.salesInvoice.columns.additional_discount")}
        collapsible
        defaultOpen
      >
        <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
          <FormInput label={t("finances.salesInvoice.columns.discount_on")}>
            <Select
              value={data.discount_on}
              onValueChange={(val) => setData("discount_on", val)}
              placeholder={t(
                "finances.salesInvoice.columns.discount_on.placeholder",
              )}
              optionTrans="finances.salesInvoice.columns.discount_on.options"
              options={["grand_total", "net_total"]}
            />
          </FormInput>
          <FormInput
            disabled={!data?.discount_on}
            label={`${t("finances.salesInvoice.columns.additional_discount_rate")}`}
          >
            <CurrencyInput
              className="text-right"
              decimalScale={2}
              value={data.discount_rate}
              suffix="%"
            ></CurrencyInput>
          </FormInput>
          <FormInput
            disabled={!data?.discount_on}
            label={`${t("finances.salesInvoice.columns.additional_discount_amount")}`}
            className="col-start-2"
          >
            <CurrencyInput
              className="text-right"
              decimalScale={2}
              value={data.discount_amount}
              currencyCode={data?.currency?.code ?? "default"}
            ></CurrencyInput>
          </FormInput>
        </div>
      </FormPageContent>
      <FormPageContent
        value="detail"
        title={t("finances.salesInvoice.columns.external_note")}
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
        title={t("finances.salesInvoice.columns.terms")}
      >
        <div className="px-1 py-1">
          <FormTable
            name="paymentSchedules"
            className="col-start-1 col-span-2"
            readOnly={disabled}
            columns={paymentScheduleColumns}
            value={data?.payment_schedules ?? []}
            onValueChange={(v) => setData("payment_schedules", v)}
            mapItem={({ item }) => {
              const payment_amount = amount * (item?.invoice_portion / 100);
              return {
                ...item,
                payment_amount,
                outstanding_amount: payment_amount,
              };
            }}
          />
        </div>
      </FormPageContent>
    </>
  );
}
