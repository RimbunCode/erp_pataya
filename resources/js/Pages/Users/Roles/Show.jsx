import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import React from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Show({ role }) {
  const { t } = useLaravelReactI18n();
  return (
    <FormPage
      isCreate={!role}
      fieldNameTrans="user.role.columns"
      title={role?.name ?? t("user.role.new")}
      name="role"
    >
      <Form />
    </FormPage>
  );
}
