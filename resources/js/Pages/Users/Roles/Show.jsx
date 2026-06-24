import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import React from "react";

export default function Show({ role }) {
  return (
    <FormPage isCreate={!role} fieldNameTrans="user.role.columns" name="role">
      <Form />
    </FormPage>
  );
}
