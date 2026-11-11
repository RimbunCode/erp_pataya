import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";

export default function Show({ journalVoucher, defaultData }) {
  return (
    <FormPage
      name="journalVoucher"
      fieldNameTrans="finances.journalVoucher.columns"
      disabled={journalVoucher?.submitted_at}
      submitable
      isCreate={!journalVoucher}
      defaultValues={defaultData}
    >
      <Form />
    </FormPage>
  );
}
