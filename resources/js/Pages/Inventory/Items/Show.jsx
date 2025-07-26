import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";

export default function Show({ item }) {
  return (
    <FormPage name="item" title={item.name}>
      <Form />
    </FormPage>
  );
}
