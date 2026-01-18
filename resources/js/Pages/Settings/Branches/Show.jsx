import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Show({ branch }) {
  const { t } = useLaravelReactI18n();
  return (
    <FormPage
      name="branch"
      title={branch.name}
      disabled={branch.is_main_branch}
      badge={
        <>
          {branch.is_main_branch && (
            <span className="text-sm badge primary">
              {t("core.branch.columns.is_main_branch")}
            </span>
          )}
        </>
      }
    >
      <Form />
    </FormPage>
  );
}
