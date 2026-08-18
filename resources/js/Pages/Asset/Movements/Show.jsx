import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";

export default function Show({ assetMovement, defaultData }) {
  return (
    <FormPage
      isCreate={!assetMovement}
      ignoreDraft={defaultData}
      name="assetMovement"
      disabled={assetMovement?.submitted_at}
      submitable
      defaultValues={defaultData}
    >
      <Form />
    </FormPage>
  );
}
