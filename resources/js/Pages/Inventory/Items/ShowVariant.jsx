import { FormPage, useFormPage } from "@/Pages/Core/FormPage";

import FormBarcodes from "./FormBarcodes";
import FormDetail from "./FormDetail";
import FormStockLevels from "./FormStockLevels";
import React from "react";
import { usePage } from "@inertiajs/react";

function Form() {
  const item = usePage().props.item;
  const { data, setData } = useFormPage();
  return (
    <>
      <FormDetail isVariant data={data} setData={setData} item={item} />
      <FormBarcodes isVariant />
      <FormStockLevels />
    </>
  );
}
export default function ShowVariant({ variant }) {
  return (
    <FormPage title={variant.sku} name="itemVariant">
      <Form />
    </FormPage>
  );
}
