import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";

export default function Show({ currency }) {
  return (
    <FormPage name="currency" primaryKey="code" title={currency.name}>
      <Form />
    </FormPage>
  );
}
