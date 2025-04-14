import { Button } from "@/Components/ui/button";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import { SaveIcon } from "lucide-react";
import { useDraftForm } from "@/Hooks/useDraftForm";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Show({ warehouse }) {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const { data, setData, put, processing, errors, isDirty } = useDraftForm(
    "warehouse",
    warehouse,
  );
  const onSubmit = (e) => {
    e.preventDefault();

    put(route("warehouses.update", warehouse.id));
  };
  return (
    <FormPage
      errors={errors}
      title={warehouse.name}
      disabled={processing || warehouse.is_main_branch}
      onSubmit={(e) => {
        e.preventDefault();
        if (warehouse.is_main_branch) return;
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
        !warehouse.is_main_branch && (
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
