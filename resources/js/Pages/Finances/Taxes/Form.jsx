import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";

import NumberInput from "@/Components/NumberInput";
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
            name="name"
            required={true}
            label={t("finances.taxes.columns.name")}
          >
            <Input
              value={data?.name ?? ""}
              onChange={(e) => setData("name", e.target.value)}
            />
          </FormInput>
          <FormInput
            name="rate"
            required={true}
            label={t("finances.taxes.columns.rate")}
          >
            <NumberInput
              className="text-left"
              value={data.rate}
              onValueChange={(value) => setData("rate", value)}
              suffix="%"
              decimalScale={2}
              min={0}
              max={100}
            />
          </FormInput>
        </div>
      </FormPageContent>
    </>
  );
}
