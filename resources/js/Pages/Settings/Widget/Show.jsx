import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Show({ widget, defaultData }) {
  const { t } = useLaravelReactI18n();

  return (
    <FormPage
      isCreate={!widget}
      name="widget"
      title={widget ? widget.code : t("settings.widget.new")}
      ignoreDraft={defaultData}
      defaultValues={defaultData}
    >
      <Form />
    </FormPage>
  );
}
