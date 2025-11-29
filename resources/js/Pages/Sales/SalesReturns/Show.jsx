import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Show({ salesReturn }) {
  const { t } = useLaravelReactI18n();

  return (
    <FormPage
      defaultValues={{
        salesReturn,
      }}
      isCreate={!salesReturn}
      // ignoreDraft={salesReturn}
      name="salesReturn"
      title={salesReturn ? salesReturn.code : t("finances.salesReturn.new")}
      disabled={salesReturn?.submitted_at}
      submitable
    >
      <Form />
    </FormPage>
  );
}
