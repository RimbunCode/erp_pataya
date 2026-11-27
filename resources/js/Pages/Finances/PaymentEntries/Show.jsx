import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import PostedAccountsPanel from "@/Pages/Finances/Components/PostedAccountsPanel";

export default function Show({ paymentEntry, defaultData }) {
  return (
    <FormPage
      name="paymentEntry"
      disabled={paymentEntry?.submitted_at}
      submitable
      isCreate={!paymentEntry}
      ignoreDraft={defaultData}
      defaultValues={defaultData}
    >
      <Form />
      <PostedAccountsPanel isNew={!paymentEntry} />
    </FormPage>
  );
}
