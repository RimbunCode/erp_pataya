import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";

export default function Show({ dashboard, defaultData }) {
  return (
    <FormPage
      isCreate={!dashboard}
      name="dashboard"
      ignoreDraft={defaultData}
      defaultValues={defaultData}
    >
      <Form />
    </FormPage>
  );
}
