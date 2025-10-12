import { cn, getThemeByStatus } from "@/lib/utils";

import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useMemo } from "react";

export default function Show({
  paymentEntry,
  paymentable_type,
  paymentable_id,
  payment_type,
  partyable_type,
  partyable,
  currency,
  paid_amount,
  payment_method,
}) {
  const { t } = useLaravelReactI18n();

  const statusBadge = useMemo(() => {
    // if (data?.status == "draft") return;
    const status = t(`core.form.statuses.${paymentEntry?.status}`);
    const theme = getThemeByStatus(paymentEntry?.status);

    return (
      <span className={cn("text-sm badge capitalize", theme)}>{status}</span>
    );
  }, [paymentEntry?.status, t]);

  return (
    <FormPage
      name="paymentEntry"
      title={paymentEntry?.code}
      disabled={(paymentEntry?.status ?? "draft") != "draft"}
      submitable
      badge={statusBadge}
      isCreate={!paymentEntry}
      ignoreDraft={paymentable_type}
      defaultValues={{
        paymentable_type,
        paymentable_id,
        payment_type,
        partyable_type,
        partyable,
        currency,
        date: new Date(),
        paid_amount,
        payment_method,
      }}
    >
      <Form />
    </FormPage>
  );
}
