import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import FormInput from "@/Components/FormInput";
import React from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { Textarea } from "@/Components/ui/textarea";
import PaymentMethodLinkModel from "../PaymentMethods/PaymentMethodLinkModel";
import CurrencyInput from "@/Components/CurrencyInput";
import LinkModel from "@/Components/LinkModel";

export default function Form() {
  const { data } = useFormPage();
  const { t } = useLaravelReactI18n();

  return (
    <>
      <FormPageContent title={null} value="detail">
        <div className="grid md:grid-cols-2  gap-x-3 gap-y-4">
          <FormInput
            required={true}
            label={t("finances.paymentSchedule.columns.reference_to")}
            name="reference_to"
          >
            <LinkModel
              className="pointer-events-auto"
              value={data.payment_scheduleable}
              model={data.payment_scheduleable_type}
              disabledAddButton={true}
            />
          </FormInput>
          <FormInput
            required={false}
            label={t("finances.paymentSchedule.columns.payment_method")}
          >
            <PaymentMethodLinkModel value={data.payment_method} />
          </FormInput>

          <FormInput
            required={false}
            label={t("finances.paymentSchedule.columns.outstanding_amount")}
          >
            <CurrencyInput
              decimalScale={2}
              value={data.outstanding_amount}
              currencyCode={data?.currency?.code}
              placeholder={t(
                "finances.paymentSchedule.columns.outstanding_amount.placeholder",
              )}
            />
          </FormInput>
          <FormInput
            required={false}
            label={t("finances.paymentSchedule.columns.payment_amount")}
          >
            <CurrencyInput
              decimalScale={2}
              currencyCode={data?.currency?.code}
              value={data.payment_amount}
              className="items-left"
              placeholder={t(
                "finances.paymentSchedule.columns.payment_amount.placeholder",
              )}
            />
          </FormInput>
        </div>
      </FormPageContent>
      <FormPageContent
        title={t("finances.paymentSchedule.columns.description")}
        value="detail"
      >
        <Textarea value={data?.description ?? ""} />
      </FormPageContent>
    </>
  );
}
