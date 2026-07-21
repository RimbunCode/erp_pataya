import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";

import AssignedToFields from "./AssignedToFields";
import React from "react";

function Form() {
  const { data, setData } = useFormPage({
    priority: "medium",
    status: "open",
  });

  return (
    <FormPageContent value="detail">
      <AssignedToFields value={data} onChange={setData} layout="grid" />
    </FormPageContent>
  );
}

export default Form;
