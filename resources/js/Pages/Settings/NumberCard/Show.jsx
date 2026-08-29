import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";

export default function Show({ numberCard, defaultData }) {
  return (
    <FormPage
      isCreate={!numberCard}
      name="numberCard"
      ignoreDraft={defaultData}
      defaultValues={defaultData}
    >
      <Form />
    </FormPage>
  );
}
