import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import ServiceActivityLog from "./ServiceActivityLog";

export default function Show({ assetService, defaultData }) {
  const isApproved = (assetService?.status ?? []).includes("approved");

  return (
    <FormPage
      isCreate={!assetService}
      ignoreDraft={defaultData}
      name="assetService"
      disabled={assetService?.submitted_at}
      submitable
      defaultValues={defaultData}
    >
      <Form />
      {assetService && isApproved && (
        <ServiceActivityLog assetService={assetService} />
      )}
    </FormPage>
  );
}
