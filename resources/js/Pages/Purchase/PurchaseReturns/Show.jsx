import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Show({ purchaseReturn }) {
  const { t } = useLaravelReactI18n();

  return (
    <FormPage
      defaultValues={{
        purchaseReturn,
      }}
      isCreate={!purchaseReturn}
      // ignoreDraft={purchaseReturn}
      name="purchaseReturn"
      title={
        purchaseReturn ? purchaseReturn.code : t("purchase.purchaseReturn.new")
      }
      disabled={purchaseReturn?.submitted_at}
      submitable
    >
      <Form />
    </FormPage>
  );
}
