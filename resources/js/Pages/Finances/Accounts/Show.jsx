import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

export default function Show({ account }) {
  const { t } = useLaravelReactI18n();
  const loadFrom = usePage().props.loadFrom;

  return (
    <FormPage
      isCreate={!account}
      ignoreDraft={loadFrom}
      name="account"
      title={account ? account.code : t("finance.account.new")}
      disabled={account?.have_transactions}
    >
      <Form />
    </FormPage>
  );
}
