import { Button } from "@/Components/ui/button";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import { SaveIcon } from "lucide-react";
import { useDraftForm } from "@/Hooks/useDraftForm";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Show({ itemAlternative }) {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const { data, setData, put, processing, errors, isDirty } = useDraftForm(
    "itemAlternative",
    itemAlternative,
  );
  const onSubmit = (e) => {
    e.preventDefault();

    put(route("itemAlternatives.update", itemAlternative.id));
  };
  return (
    <FormPage
      errors={errors}
      title={itemAlternative.item.code}
      disabled={processing}
      onSubmit={(e) => {
        e.preventDefault();
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
        <Button
          type="submit"
          className="!p-2 size-fit h-8"
          disabled={processing}
        >
          <SaveIcon />
          {t("core.form.save")}
        </Button>
      }
      data={data}
      setData={setData}
    >
      <Form />
    </FormPage>
  );
}
