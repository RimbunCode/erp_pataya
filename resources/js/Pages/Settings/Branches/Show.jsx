/* eslint-disable jsdoc/require-jsdoc */
import { Button } from "@/Components/ui/button";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import { SaveIcon } from "lucide-react";
import { useDraftForm } from "@/Hooks/useDraftForm";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Show({ branch }) {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const { data, setData, put, processing, errors, isDirty } = useDraftForm(
    "branch",
    branch,
  );
  const onSubmit = (e) => {
    e.preventDefault();

    put(route("branches.update", branch.id));
  };
  return (
    <FormPage
      errors={errors}
      title={branch.name}
      disabled={processing || branch.is_main_branch}
      onSubmit={(e) => {
        e.preventDefault();
        if (branch.is_main_branch) return;
        onSubmit(e);
      }}
      badge={
        <>
          {branch.is_main_branch && (
            <span className="text-sm badge primary">
              {t("core.branch.columns.is_main_branch")}
            </span>
          )}
          {isDirty && (
            <span className="text-sm badge warning">
              {t("core.form.not_saved")}
            </span>
          )}
        </>
      }
      controls={
        !branch.is_main_branch && (
          <Button
            type="submit"
            className="!p-2 size-fit h-8"
            disabled={processing}
          >
            <SaveIcon />
            {t("core.form.save")}
          </Button>
        )
      }
      data={data}
      setData={setData}
    >
      <Form />
    </FormPage>
  );
}
