import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import React, { useMemo } from "react";

import CustomerLinkModel from "@/Pages/Sales/Customers/CustomerLinkModel";
import DatetimePicker from "@/Components/DatetimePicker";
import FormInput from "@/Components/FormInput";
import LinkModel from "@/Components/LinkModel";
import NumberInput from "@/Components/NumberInput";
import OpportunityLinkModel from "@/Pages/CRM/Opportunities/OpportunityLinkModel";
import QuotationItems from "./QuotationItems";
import { calculateArray } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Form() {
  const { t } = useLaravelReactI18n();
  const { data, setData, disabled } = useFormPage({
    date: new Date(),
  });

  const amount = useMemo(() => {
    return calculateArray(
      (data?.items ?? []).map((item) => ({
        amount: (item.quantity ?? 0) * (item.price ?? 0),
      })),
      "amount",
      "+",
    );
  }, [data?.items]);

  return (
    <>
      <FormPageContent title={t("crm.quotation.detail")} value="detail">
        <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
          <FormInput
            label={t("crm.quotation.columns.date")}
            required={true}
            name="date"
          >
            <DatetimePicker
              type="datetime"
              value={data?.date}
              onValueChange={(val) => setData("date", val)}
              disabled={disabled}
            />
          </FormInput>
          <FormInput
            name="valid_until"
            label={t("crm.quotation.columns.valid_until")}
          >
            <DatetimePicker
              type="date"
              value={data?.valid_until}
              onValueChange={(val) => setData("valid_until", val)}
              disabled={disabled}
            />
          </FormInput>
          <FormInput
            label={t("crm.quotation.columns.customer")}
            required={true}
            name="customer"
          >
            <CustomerLinkModel
              placeholder={t("crm.quotation.columns.customer.placeholder")}
              value={data?.customer}
              onValueChange={(val) => setData("customer", val)}
              disabled={disabled}
            />
          </FormInput>
          <FormInput
            name="opportunity"
            label={t("crm.quotation.columns.opportunity")}
          >
            <OpportunityLinkModel
              placeholder={t("crm.quotation.columns.opportunity.placeholder")}
              value={data?.opportunity}
              onValueChange={(val) => setData("opportunity", val)}
              disabled={disabled || !!data?.referenceable}
            />
          </FormInput>
          {data?.referenceable && (
            <FormInput
              className="pointer-events-auto! col-span-full"
              label={t("crm.quotation.columns.reference_to")}
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

      <QuotationItems
        value={data?.items ?? []}
        onValueChange={(val) => setData("items", val)}
        readOnly={disabled}
      />

      <FormPageContent value="detail" title={null}>
        <FormInput
          readOnly
          label={t("crm.quotation.columns.amount")}
          className="md:col-start-2"
        >
          <NumberInput decimalScale={2} value={amount} readOnly />
        </FormInput>
      </FormPageContent>
    </>
  );
}
