import {
  FormPageContent,
  FormPageContentTitle,
  useFormPage,
} from "@/Pages/Core/FormPage";

import CurrencyInput from "@/Components/CurrencyInput";
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
        <FormPageContentTitle></FormPageContentTitle>
        <div className="grid gap-x-3 gap-y-4">
          <FormInput required={true} label={t("finances.taxes.columns.name")}>
            <Input
              value={data?.name ?? ""}
              onChange={(e) => setData("name", e.target.value)}
            />
          </FormInput>
          <FormInput required={true} label={t("finances.taxes.columns.rate")}>
            <CurrencyInput
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
