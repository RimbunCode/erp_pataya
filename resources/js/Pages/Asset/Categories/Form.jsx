import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";

import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import React from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Form() {
  const { data, setData } = useFormPage();
  const { t } = useLaravelReactI18n();

  return (
    <>
      <FormPageContent title={null} value="detail">
        <div className="grid gap-x-3 gap-y-4">
          <FormInput
            name="category_name"
            required={true}
            label={t("asset.category.columns.category_name")}
          >
            <Input
              value={data?.category_name ?? ""}
              onChange={(e) => setData("category_name", e.target.value)}
            />
          </FormInput>
          <div className="flex flex-col gap-y-2">
            <FormCheckbox
              checked={data?.non_depreciable_category ?? false}
              onCheckedChange={(val) =>
                setData("non_depreciable_category", val)
              }
            >
              {t("asset.category.columns.non_depreciable_category")}
            </FormCheckbox>
          </div>
        </div>
      </FormPageContent>
    </>
  );
}
