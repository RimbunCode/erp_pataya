import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";

export default function Show({ internalOrder }) {
  return (
    <FormPage
      name="internalOrder"
      title={internalOrder.code}
      disabled={internalOrder?.submitted_at}
      submitable
    >
      <Form />
    </FormPage>
  );
}
