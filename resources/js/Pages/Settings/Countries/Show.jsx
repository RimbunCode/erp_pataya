import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";

export default function Show({ country }) {
  return (
    <FormPage isCreate={!country} name="country" primaryKey="code">
      <Form />
    </FormPage>
  );
}
