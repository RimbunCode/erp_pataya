import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";

export default function Show({ stockEntry, defaultData }) {
  return (
    <FormPage
      name="stockEntry"
      ignoreDraft={defaultData}
      defaultValues={defaultData}
      title={stockEntry?.code}
      disabled={stockEntry?.submitted_at}
      submitable
    >
      <Form />
    </FormPage>
  );
}
