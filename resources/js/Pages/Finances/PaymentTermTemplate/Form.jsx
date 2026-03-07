import {
  FormPageContent,
  FormPageContentDescription,
  useFormPage,
} from "@/Pages/Core/FormPage";

import CurrencyInput from "@/Components/CurrencyInput";
import DatetimePicker from "@/Components/DatetimePicker";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import { Input } from "@/Components/ui/input";
import PaymentMethodLinkModel from "../PaymentMethods/PaymentMethodLinkModel";
import React from "react";
import Select from "@/Components/Select";
import { Textarea } from "@/Components/ui/textarea";
import { generateRandom } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useMemo } from "react";
import { usePage } from "@inertiajs/react";

export default function Form() {
  const { default_currency_id } = usePage().props.preferences;
  const { data, setData } = useFormPage();
  const { t } = useLaravelReactI18n();
  const { date, amount } = useMemo(
    () => ({ date: new Date(), amount: 10000000 }),
    [],
  );
  const templateColumns = [
    {
      name: "invoice_portion",
      titleTrans: "finances.paymentTerm.columns.invoice_portion",
      required: true,
      cell({ data, setData, attributes }) {
        return (
          <CurrencyInput
            className="text-left"
            value={data}
            onValueChange={(value) => setData("invoice_portion", value)}
            decimalsLimit={2}
            suffix="%"
            min={0}
            max={100}
            {...attributes}
          />
        );
      },
    },
    {
      name: "description",
      titleTrans: "finances.paymentSchedule.columns.description",
      show: true,
      type: "text",
      width: 2,
      cell({ dataRow, data, setData, attributes }) {
        return (
          <Textarea
            disabled={!dataRow?.invoice_portion}
            rows={1}
            value={data ?? ""}
            onChange={(e) => setData("description", e.target.value)}
            {...attributes}
          />
        );
      },
    },
    {
      name: "due_date_based_on",
      titleTrans: "finances.paymentTerm.columns.due_date_based_on",
      required: true,
      width: 2,
      cell({ dataRow, data, setData, attributes }) {
        return (
          <Select
            value={data}
            onValueChange={(val) =>
              setData({
                due_date_based_on: val,
                credit_period:
                  dataRow.due_date_based_on != val ? 0 : dataRow.credit_period,
              })
            }
            placeholder={t(
              "finances.paymentTerm.columns.due_date_based_on.placeholder",
            )}
            optionTrans="finances.paymentTerm.columns.due_date_based_on.options"
            options={[
              "days_after_invoice_date",
              "weeks_after_invoice_week",
              "months_after_invoice_month",
            ]}
            {...attributes}
          />
        );
      },
    },
    {
      name: "credit_period",
      titleTrans: "finances.paymentTerm.columns.credit_period",
      required: true,
      width: 1,
      cell({ dataRow, data, setData, attributes }) {
        return (
          <CurrencyInput
            className="text-left"
            decimalsLimit={0}
            placeholder="0"
            value={data}
            onValueChange={(value) => {
              setData("credit_period", value);
            }}
            {...attributes}
            disabled={!dataRow.due_date_based_on || attributes.disabled}
          />
        );
      },
    },
    {
      name: "payment_method",
      titleTrans: "finances.paymentTerm.columns.payment_method",
      show: true,
      width: 2,
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
      titleTrans: "finances.paymentTerm.columns.discount_type",
      cell({ data, setData, attributes }) {
        return (
          <Select
            value={data}
            onValueChange={(val) => setData("discount_type", val)}
            placeholder={t(
              "finances.paymentTerm.columns.discount_type.placeholder",
            )}
            optionTrans="finances.paymentTerm.columns.discount_type.options"
            options={["percentage", "amount"]}
            {...attributes}
          />
        );
      },
    },
    {
      name: "discount",
      titleTrans: "finances.paymentTerm.columns.discount",
      cell({ dataRow, data, setData, attributes }) {
        return (
          <CurrencyInput
            className="text-left"
            value={data}
            onValueChange={(value) => setData("discount", value)}
            decimalsLimit={2}
            suffix={dataRow.discount_type == "percentage" ? "%" : ""}
            min={dataRow.discount_type == "percentage" && 0}
            max={dataRow.discount_type == "percentage" && 100}
            {...attributes}
            disabled={!dataRow.discount_type || attributes.disabled}
          />
        );
      },
    },
  ];
  const paymentScheduleColumns = useMemo(() => {
    return [
      {
        name: "due_date",
        titleTrans: "finances.paymentSchedule.columns.due_date",
        required: true,
        cell({ data, attributes }) {
          return (
            <DatetimePicker type="datetime" value={data} {...attributes} />
          );
        },
      },
      {
        name: "description",
        titleTrans: "finances.paymentSchedule.columns.description",
        show: false,
        type: "text",
        width: 2,
        cell({ dataRow, data, attributes }) {
          return (
            <Textarea
              disabled={!dataRow?.item}
              rows={1}
              value={data ?? ""}
              {...attributes}
            />
          );
        },
      },
      {
        name: "invoice_portion",
        titleTrans: "finances.paymentSchedule.columns.invoice_portion",
        required: true,
        width: 1,
        cell({ data, attributes }) {
          return (
            <CurrencyInput
              decimalScale={2}
              suffix="%"
              value={data}
              {...attributes}
            />
          );
        },
      },
      {
        name: "payment_amount",
        titleTrans: "finances.paymentSchedule.columns.payment_amount",
        required: true,
        readOnly: true,
        width: 1,
        cell({ dataRow, additionalData, attributes }) {
          return (
            <CurrencyInput
              disabled={!dataRow.invoice_portion}
              decimalScale={2}
              currencyCode={default_currency_id}
              value={additionalData?.payment_amount ?? 0}
              {...attributes}
            />
          );
        },
      },
      {
        name: "payment_method",
        titleTrans: "finances.paymentSchedule.columns.payment_method",
        width: 1,
        cell({ data, attributes }) {
          return (
            <PaymentMethodLinkModel
              value={data}
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
        titleTrans: "finances.paymentSchedule.columns.discount_type",
        width: 1,
        cell({ data, attributes }) {
          return (
            <Select
              value={data}
              {...attributes}
              placeholder={t(
                "finances.paymentSchedule.columns.discount_type.placeholder",
              )}
              optionTrans="finances.paymentSchedule.columns.discount_type.options"
              options={["percentage", "amount"]}
            />
          );
        },
      },
      {
        name: "discount_date",
        titleTrans: "finances.paymentSchedule.columns.discount_date",
        width: 1,
        cell({ data, attributes }) {
          return (
            <DatetimePicker type="datetime" value={data} {...attributes} />
          );
        },
      },
      {
        name: "discount",
        titleTrans: "finances.paymentSchedule.columns.discount",
        width: 1,
        cell({ data: discount, dataRow, attributes }) {
          return (
            <CurrencyInput
              className="text-left"
              value={discount}
              currencyCode={
                dataRow.discount_type == "percentage"
                  ? undefined
                  : default_currency_id
              }
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
        titleTrans: "finances.paymentSchedule.columns.outstanding_amount",
        readOnly: true,
        width: 1,
        cell({ data, attributes }) {
          return (
            <CurrencyInput
              decimalScale={2}
              currencyCode={default_currency_id}
              value={data}
              {...attributes}
            />
          );
        },
      },
    ];
  }, [default_currency_id]);
  const examplePaymentTermItems = useMemo(() => {
    const template =
      data?.items?.map((item) => {
        const due_date = new Date(date);
        switch (item?.due_date_based_on) {
          case "days_after_invoice_date": {
            due_date.setDate(due_date.getDate() + (item?.credit_period ?? 0));
            break;
          }
          case "weeks_after_invoice_week": {
            due_date.setDate(
              due_date.getDate() + (item?.credit_period ?? 0) * 7,
            );
            break;
          }
          case "months_after_invoice_month": {
            due_date.setMonth(due_date.getMonth() + (item?.credit_period ?? 0));
            break;
          }
        }
        return {
          id: generateRandom(5),
          due_date,
          invoice_portion: item?.invoice_portion,
          discount_type: item?.discount_type,
          discount_date: item?.discount_type ? due_date : undefined,
          discount: item?.discount,
          payment_method: item?.payment_method,
        };
      }) ?? [];
    return template;
  }, [data, date]);
  return (
    <>
      <FormPageContent title={null} value="detail">
        <div className="grid md:grid-cols-2  gap-x-3 gap-y-4">
          <FormInput
            required={true}
            name="name"
            label={t("finances.paymentTerm.columns.name")}
          >
            <Input
              value={data?.name ?? ""}
              onChange={(e) => setData("name", e.target.value)}
            />
          </FormInput>
          <FormInput
            label={t("finances.paymentTerm.columns.description")}
            className="col-start-1 col-span-full"
            name="description"
          >
            <Textarea
              value={data?.description ?? ""}
              onChange={(e) => setData("description", e.target.value)}
            />
          </FormInput>
          <FormTable
            name="paymentTermTemplateItems"
            className="col-start-1 col-span-full"
            columns={templateColumns}
            value={data.items ?? []}
            onValueChange={(val) => setData("items", val)}
          />
        </div>
      </FormPageContent>
      <FormPageContent
        title={t("finances.paymentTermTemplate.example")}
        value="detail"
      >
        <FormPageContentDescription>
          {t("finances.paymentTermTemplate.example.description")}
        </FormPageContentDescription>
        <div className="grid grid-cols-2 gap-4">
          <FormInput
            label={t("finances.paymentTermTemplate.example.invoice_date")}
            readOnly
          >
            <DatetimePicker type="datetime" value={date} readOnly />
          </FormInput>
          <FormInput
            label={t("finances.paymentTermTemplate.example.invoice_total")}
            readOnly
          >
            <CurrencyInput
              decimalScale={2}
              currencyCode={default_currency_id}
              value={amount}
            />
          </FormInput>
          <FormTable
            name="paymentScheduleExamples"
            className="col-start-1 col-span-2"
            readOnly={true}
            additionalData={(value) => {
              const result = {};
              value?.forEach((item) => {
                const payment_amount = (amount * item?.invoice_portion) / 100;

                result[item.id] = {
                  payment_amount,
                  outstanding_amount: payment_amount,
                };
              });

              return result;
            }}
            columns={paymentScheduleColumns}
            value={examplePaymentTermItems}
          />
        </div>
      </FormPageContent>
    </>
  );
}
