import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";

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
  return (
    <FormPage
      name="paymentEntry"
      title={paymentEntry?.code}
      disabled={paymentEntry?.submitted_at}
      submitable
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
