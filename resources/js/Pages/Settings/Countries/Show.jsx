import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";

export default function Show({ country }) {
  return (
    <FormPage name="country" title={country.name}>
      <Form />
    </FormPage>
  );
}
