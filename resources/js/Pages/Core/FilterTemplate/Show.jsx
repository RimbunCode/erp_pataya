import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";

export default function Show({ filterTemplate }) {
  return (
    <FormPage isCreate={!filterTemplate} name="filterTemplate">
      <Form />
    </FormPage>
  );
}
