import {
  FormPageContent,
  FormPageContentTitle,
  useFormPage,
} from "@/Pages/Core/FormPage";

import CurrencyInput from "@/Components/CurrencyInput";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import { Input } from "@/Components/ui/input";
import PaymentMethodLinkModel from "../PaymentMethods/PaymentMethodLinkModel";
import Select from "@/Components/Select";
import { Textarea } from "@/Components/ui/textarea";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useMemo } from "react";

export default function Form() {
  const { data, setData } = useFormPage();
  const { t } = useLaravelReactI18n();
  const templateColumns = useMemo(() => {
    return [
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
        name: "due_date_based_on",
        titleTrans: "finances.paymentTerm.columns.due_date_based_on",
        required: true,
        width: 2,
        cell({ data, setData, attributes }) {
          return (
            <Select
              value={data}
              onValueChange={(val) =>
                setData({
                  due_date_based_on: val,
                  credit_period: 0,
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
  }, []);
  return (
    <>
      <FormPageContent title={null} value="detail">
        <FormPageContentTitle></FormPageContentTitle>
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
            mapItem={(item) => {}}
          />
        </div>
      </FormPageContent>
    </>
  );
}
