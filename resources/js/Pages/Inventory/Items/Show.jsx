import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";

export default function Show({ item }) {
  return (
    <FormPage isCreate={!item} name="item">
      <Form />
    </FormPage>
  );
}
