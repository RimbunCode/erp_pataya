import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";

import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import { memo } from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default memo(function Form() {
  const { data, setData, isCreate } = useFormPage();
  const { t } = useLaravelReactI18n();

  return (
    <FormPageContent
      title={t("core.currency.currency_detail")}
      value="currency_detail"
    >
      <div className="grid pt-2 gap-x-4 gap-y-4 md:grid-cols-2">
        <FormInput
          label={t("core.currency.columns.code")}
          required={true}
          name="code"
        >
          <Input
            value={data.code ?? ""}
            onChange={(e) => setData("code", e.target.value.toUpperCase())}
            maxLength={3}
            disabled={!isCreate}
          />
        </FormInput>
        <FormInput
          label={t("core.currency.columns.name")}
          required={true}
          name="name"
        >
          <Input
            value={data.name ?? ""}
            onChange={(e) => setData("name", e.target.value)}
          />
        </FormInput>
        <FormInput label={t("core.currency.columns.symbol")} name="symbol">
          <Input
            value={data.symbol ?? ""}
            onChange={(e) => setData("symbol", e.target.value)}
            maxLength={10}
          />
        </FormInput>
        <FormInput
          label={t("core.currency.columns.number_format")}
          name="number_format"
        >
          <Input
            value={data.number_format ?? ""}
            onChange={(e) => setData("number_format", e.target.value)}
            placeholder="e.g. #.###,##"
          />
        </FormInput>
      </div>
    </FormPageContent>
  );
});
