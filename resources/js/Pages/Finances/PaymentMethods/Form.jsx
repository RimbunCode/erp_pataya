import {
  FormPageContent,
  FormPageContentTitle,
  useFormPage,
} from "@/Pages/Core/FormPage";
import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import React from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import CurrencyInput from "@/Components/CurrencyInput";
import { Textarea } from "@/Components/ui/textarea";

export default function Form() {
  const { data, setData } = useFormPage();
  const { t } = useLaravelReactI18n();

  return (
    <>
      <FormPageContent title={null} value="detail">
        <FormPageContentTitle></FormPageContentTitle>
        <div className="grid gap-x-3 gap-y-4">
          <FormInput
            required={true}
            label={t("finances.paymentMethod.columns.name")}
          >
            <Input
              value={data?.name ?? ""}
              onChange={(e) => setData("name", e.target.value)}
            />
          </FormInput>
          <FormInput
            required={true}
            label={t("finances.paymentMethod.columns.description")}
          >
            <Textarea
              value={data?.description ?? ""}
              onChange={(e) => setData("description", e.target.value)}
            />
          </FormInput>
        </div>
      </FormPageContent>
    </>
  );
}
