import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";

import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import { Input } from "@/Components/ui/input";
import Select from "@/Components/Select";
import { memo, useMemo } from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";

const IANA_TIMEZONES = Intl.supportedValuesOf("timeZone").map((tz) => ({
  label: tz,
  value: tz,
}));

const toTableValue = (timezones) => (timezones ?? []).map((tz) => ({ tz }));

const fromTableValue = (rows) => rows.map((row) => row.tz).filter(Boolean);

export default memo(function Form() {
  const { data, setData, isCreate, dataBefore } = useFormPage();
  const { t } = useLaravelReactI18n();

  const timezoneColumns = useMemo(
    () => [
      {
        name: "tz",
        titleTrans: "core.country.columns.timezones",
        required: true,
        show: true,
        cell({ data: tz, setData, attributes }) {
          return (
            <Select
              value={tz}
              onValueChange={(val) => setData("tz", val)}
              options={IANA_TIMEZONES}
              placeholder="e.g. Asia/Jakarta"
              {...attributes}
            />
          );
        },
      },
    ],
    [],
  );

  return (
    <FormPageContent
      title={t("core.country.country_detail")}
      value="country_detail"
    >
      <div className="grid pt-2 gap-x-4 gap-y-4 md:grid-cols-2">
        <FormInput
          label={t("core.country.columns.code")}
          required={true}
          name="code"
        >
          <Input
            value={data.code ?? ""}
            onChange={(e) => setData("code", e.target.value.toUpperCase())}
            maxLength={2}
            disabled={!isCreate}
          />
        </FormInput>
        <FormInput
          label={t("core.country.columns.name")}
          required={true}
          name="name"
        >
          <Input
            value={data.name ?? ""}
            onChange={(e) => setData("name", e.target.value)}
          />
        </FormInput>
        <FormInput label={t("core.country.columns.lang_code")} name="lang_code">
          <Input
            value={data.lang_code ?? ""}
            onChange={(e) => setData("lang_code", e.target.value)}
            placeholder="e.g. id, en, zh-Hans"
          />
        </FormInput>
        <FormInput label={t("core.country.columns.url_flag")} name="url_flag">
          <Input
            value={data.url_flag ?? ""}
            onChange={(e) => setData("url_flag", e.target.value)}
            placeholder="https://..."
          />
        </FormInput>
        <div className="md:col-span-2">
          <FormTable
            name="CountryTimezones"
            label={t("core.country.columns.timezones")}
            columns={timezoneColumns}
            value={toTableValue(data.timezones)}
            valueBefore={
              dataBefore?.timezones !== undefined
                ? toTableValue(dataBefore.timezones)
                : undefined
            }
            onValueChange={(rows) => setData("timezones", fromTableValue(rows))}
          />
        </div>
      </div>
    </FormPageContent>
  );
});
