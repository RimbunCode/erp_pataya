import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";

export default function Show({ chart, defaultData }) {
  return (
    <FormPage
      isCreate={!chart}
      name="chart"
      ignoreDraft={defaultData}
      defaultValues={defaultData}
    >
      <Form />
    </FormPage>
  );
}
