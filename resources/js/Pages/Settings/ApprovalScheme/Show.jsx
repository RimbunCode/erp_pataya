import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";

export default function Show({ approvalScheme }) {
  return (
    <FormPage isCreate={!approvalScheme} name="approvalScheme">
      <Form />
    </FormPage>
  );
}
