import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";

import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import React from "react";
import Select from "@/Components/Select";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Form() {
  const { data, setData } = useFormPage();
  const { t } = useLaravelReactI18n();

  return (
    <>
      <FormPageContent title={null} value="detail">
        <div className="grid gap-x-3 gap-y-4">
          <FormInput
            required={true}
            label={t("inventory.category.columns.name")}
          >
            <Input
              value={data?.name ?? ""}
              onChange={(e) => setData("name", e.target.value)}
            />
          </FormInput>
          <FormInput
            required={true}
            label={t("inventory.category.columns.type")}
          >
            <Select
              value={data?.type ?? ""}
              onValueChange={(v) => setData("type", v)}
              placeholder={t("inventory.category.columns.type.placeholder")}
              optionTrans="inventory.category.types"
              options={["stock", "vehicle", "service"]}
            />
          </FormInput>
        </div>
      </FormPageContent>
    </>
  );
}
