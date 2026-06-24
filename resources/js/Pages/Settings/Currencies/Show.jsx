import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";

export default function Show({ currency }) {
  return (
    <FormPage isCreate={!currency} name="currency" primaryKey="code">
      <Form />
    </FormPage>
  );
}
