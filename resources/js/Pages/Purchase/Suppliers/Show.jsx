import { Button } from "@/Components/ui/button";
import Form from "./Form";
import { FormPage } from "@/Pages/Core/FormPage";
import React from "react";
import { SaveIcon } from "lucide-react";
import { useDraftForm } from "@/Hooks/useDraftForm";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Show({ supplier }) {
  const { t } = useLaravelReactI18n();
  const { data, setData, put, processing, errors, isDirty } = useDraftForm(
    "supplier",
    supplier,
  );
  const route = window.route;
  const onSubmit = (e) => {
    e.preventDefault();

    put(route("suppliers.update", supplier.id));
  };

  return (
    <>
      <FormPage
        isCreate={!supplier}
        errors={errors}
        disabled={processing}
        title={supplier?.name ?? t("purchase.supplier.new")}
        badge={
          isDirty && (
            <span className="text-sm badge warning">
              {t("core.form.not_saved")}
            </span>
          )
        }
        controls={
          <Button
            role="save"
            className="!p-2 size-fit h-8"
            onClick={onSubmit}
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
    </>
  );
}
