import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";

export default function Show({ approvalScheme }) {
  return (
    <FormPage name="approvalScheme" title={approvalScheme.name}>
      <Form />
    </FormPage>
  );
}
