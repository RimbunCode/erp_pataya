import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import { usePage } from "@inertiajs/react";

export default function Show({ emailTemplate }) {
  const loadFrom = usePage().props.loadFrom;

  return (
    <FormPage
      isCreate={!emailTemplate}
      ignoreDraft={loadFrom}
      name="emailTemplate"
    >
      <Form />
    </FormPage>
  );
}
