import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";

export default function Show() {
  return (
    <FormPage
      isCreate={false}
      name="stockLedger"
      disabled
      deleteable={false}
      sidebarContent={false}
      bottombarContent={false}
    >
      <Form />
    </FormPage>
  );
}
