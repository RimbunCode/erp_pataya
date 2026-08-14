import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";

export default function Show({ assetValueAdjustment, defaultData }) {
  return (
    <FormPage
      isCreate={!assetValueAdjustment}
      ignoreDraft={defaultData}
      name="assetValueAdjustment"
      disabled={assetValueAdjustment?.submitted_at}
      submitable
      defaultValues={defaultData}
    >
      <Form />
    </FormPage>
  );
}
