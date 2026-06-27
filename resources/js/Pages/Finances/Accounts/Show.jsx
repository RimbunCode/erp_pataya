import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import { usePage } from "@inertiajs/react";

export default function Show({ account }) {
  const loadFrom = usePage().props.loadFrom;

  return (
    <FormPage
      isCreate={!account}
      ignoreDraft={loadFrom}
      name="account"
      disabled={account?.have_transactions}
    >
      <Form />
    </FormPage>
  );
}
