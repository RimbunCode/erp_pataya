import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Show({ dashboard, defaultData }) {
  const { t } = useLaravelReactI18n();

  return (
    <FormPage
      isCreate={!dashboard}
      name="dashboard"
      title={dashboard ? dashboard.title : t("settings.dashboard.new")}
      ignoreDraft={defaultData}
      defaultValues={defaultData}
    >
      <Form />
    </FormPage>
  );
}
