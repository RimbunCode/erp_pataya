import React, { useMemo } from "react";

import CurrencyInput from "@/Components/CurrencyInput";
import DatetimePicker from "@/Components/DatetimePicker";
import { FormPageContent } from "@/Pages/Core/FormPage";
import FormTable from "@/Components/FormTable";
import PaymentMethodLinkModel from "../PaymentMethods/PaymentMethodLinkModel";
import PaymentTermLinkModel from "../PaymentTerms/PaymentTermLinkModel";
import Select from "@/Components/Select";
import { Textarea } from "@/Components/ui/textarea";
import { useLaravelReactI18n } from "laravel-react-i18n";

function PaymentSchedule({
  date,
  value,
  onValueChange,
  readOnly,
  currencyCode,
  additionalData,
}) {
  const { t } = useLaravelReactI18n();
  const paymentScheduleColumns = useMemo(() => {
    return [
      // {
      //   name: "payment_term",
      //   titleTrans: "finances.paymentSchedule.columns.payment_term",
      //   show: true,
      //   cell({ data: paymentTerm, setData, attributes }) {
      //     return (
      //       <PaymentTermLinkModel
      //         placeholder={t(
      //           "finances.paymentSchedule.columns.payment_term.placeholder",
      //         )}
      //         value={paymentTerm}
      //         onValueChange={(val) => {
      //           const due_date = new Date(date);
      //           switch (val?.due_date_based_on) {
      //             case "days_after_invoice_date": {
      //               due_date.setDate(
      //                 due_date.getDate() + (val?.credit_period ?? 0),
      //               );
      //               break;
      //             }
      //             case "weeks_after_invoice_week": {
      //               due_date.setDate(
      //                 due_date.getDate() + (val?.credit_period ?? 0) * 7,
      //               );
      //               break;
      //             }
      //             case "months_after_invoice_month": {
      //               due_date.setMonth(
      //                 due_date.getMonth() + (val?.credit_period ?? 0),
      //               );
      //               break;
      //             }
      //           }
      //           setData({
      //             payment_term: val,
      //             due_date,
      //             description: val?.description,
      //             invoice_portion: val?.invoice_portion,
      //             discount_type: val?.discount_type,
      //             discount_date: val?.discount_type ? due_date : undefined,
      //             discount: val?.discount,
      //             payment_method: val?.payment_method,
      //           });
      //         }}
      //         {...attributes}
      //       />
      //     );
      //   },
      // },
      {
        name: "due_date",
        titleTrans: "finances.paymentSchedule.columns.due_date",
        required: true,
        cell({ dataRow, data, setData, attributes }) {
          return (
            <DatetimePicker
              type="datetime"
              value={data}
              onValueChange={(val) =>
                setData({
                  due_date: val,
                  discount_date: dataRow?.discount_type ? val : undefined,
                })
              }
              {...attributes}
            />
          );
        },
      },
      {
        name: "description",
        titleTrans: "finances.paymentSchedule.columns.description",
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
        titleTrans: "finances.paymentSchedule.columns.invoice_portion",
        required: true,
        width: 1,
        cell({ data, setData, attributes }) {
          return (
            <CurrencyInput
              decimalScale={2}
              suffix="%"
              value={data}
              onValueChange={(val) => {
                setData({
                  invoice_portion: val,
                });
              }}
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
              currencyCode={currencyCode}
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
        titleTrans: "finances.paymentSchedule.columns.discount_type",
        width: 1,
        cell({ dataRow, data, setData, attributes }) {
          return (
            <Select
              value={data}
              onValueChange={(val) =>
                setData({
                  discount_type: val,
                  discount_date: val ? dataRow?.due_date : undefined,
                })
              }
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
        cell({ data, setData, attributes }) {
          return (
            <DatetimePicker
              type="datetime"
              value={data}
              onValueChange={(val) => setData("discount_date", val)}
              {...attributes}
            />
          );
        },
      },
      {
        name: "discount",
        titleTrans: "finances.paymentSchedule.columns.discount",
        width: 1,
        cell({ data: discount, dataRow, setData, attributes }) {
          return (
            <CurrencyInput
              className="text-left"
              value={discount}
              currencyCode={
                dataRow.discount_type == "percentage" ? undefined : currencyCode
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
        titleTrans: "finances.paymentSchedule.columns.outstanding_amount",
        readOnly: true,
        width: 1,
        cell({ data, setData, attributes }) {
          return (
            <CurrencyInput
              decimalScale={2}
              currencyCode={currencyCode}
              value={data}
              onValueChange={(val) => setData("outstanding_amount", val)}
              {...attributes}
            />
          );
        },
      },
    ];
  }, [date, currencyCode]);
  return (
    <FormPageContent
      value="terms"
      title={t("finances.paymentSchedule.columns.terms")}
    >
      <div className="px-1 py-1">
        <FormTable
          name="paymentSchedules"
          className="col-start-1 col-span-2"
          readOnly={readOnly}
          additionalData={additionalData}
          columns={paymentScheduleColumns}
          value={value}
          onValueChange={onValueChange}
        />
      </div>
    </FormPageContent>
  );
}

export default PaymentSchedule;
