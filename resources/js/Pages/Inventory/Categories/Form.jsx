/* eslint-disable jsdoc/require-jsdoc */
import {
  FormPageContent,
  FormPageContentTitle,
  useFormPage,
} from "@/Pages/Core/FormPage";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Components/ui/select";

import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import React from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

export default function Form() {
  const { data, setData } = useFormPage();
  const { t } = useLaravelReactI18n();
  const types = usePage().props.types;

  return (
    <>
      <FormPageContent title={null} value="detail">
        <FormPageContentTitle></FormPageContentTitle>
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
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t("inventory.category.columns.type.placeholder")}
                />
              </SelectTrigger>
              <SelectContent>
                {types &&
                  Object.entries(types).map(([key, type]) => (
                    <SelectItem key={key} value={key}>
                      {type}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </FormInput>
        </div>
      </FormPageContent>
    </>
  );
}
