import { Button } from "@/Components/ui/button";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import { SaveIcon } from "lucide-react";
import { useDraftForm } from "@/Hooks/useDraftForm";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Show({ unit }) {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const { data, setData, put, processing, errors, isDirty } = useDraftForm(
    "unit",
    unit,
  );
  const onSubmit = (e) => {
    e.preventDefault();

    put(route("units.update", unit.id));
  };
  return (
    <FormPage
      errors={errors}
      title={unit.name}
      disabled={processing || unit.is_default}
      onSubmit={(e) => {
        e.preventDefault();
        if (unit.is_main_branch) return;
        onSubmit(e);
      }}
      badge={
        isDirty && (
          <span className="text-sm badge warning">
            {t("core.form.not_saved")}
          </span>
        )
      }
      controls={
        !unit.is_default && (
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
