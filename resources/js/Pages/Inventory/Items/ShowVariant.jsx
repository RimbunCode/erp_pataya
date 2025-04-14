import { FormPage } from "@/Pages/Core/FormPage";
import React, { useCallback } from "react";

import { Button } from "@/Components/ui/button";
import FormDetail from "./FormDetail";
import FormStockLevels from "./FormStockLevels";
import { SaveIcon } from "lucide-react";
import { useDraftForm } from "@/Hooks/useDraftForm";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function ShowVariant({ item, variant }) {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const { data, setData, put, processing, errors, isDirty } = useDraftForm(
    "variant",
    variant,
  );
  const onSubmit = useCallback(
    (e) => {
      e.preventDefault();
      if (!variant.id) return;
      put(route("items.updateVariant", variant.id));
    },
    [variant.id, put],
  );
  return (
    <FormPage
      errors={errors}
      title={variant.sku}
      onSubmit={onSubmit}
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
    >
      <FormDetail isVariant data={data} setData={setData} item={item} />

      <FormStockLevels />
    </FormPage>
  );
}
