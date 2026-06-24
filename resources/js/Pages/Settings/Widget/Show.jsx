import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";

export default function Show({ widget, defaultData }) {
  return (
    <FormPage
      isCreate={!widget}
      name="widget"
      ignoreDraft={defaultData}
      defaultValues={defaultData}
    >
      <Form />
    </FormPage>
  );
}
