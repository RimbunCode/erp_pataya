import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import React, { useCallback, useEffect } from "react";
import SelectModel, { loadFromModel } from "@/Components/SelectModel";
import { generateRandom } from "@/lib/utils";
import DatetimePicker from "@/Components/DatetimePicker";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import { Textarea } from "@/Components/ui/textarea";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useMemo } from "react";
import { usePage } from "@inertiajs/react";
import WidgetLinkModel from "../Widget/WidgetLinkModel";
import Select from "@/Components/Select";
import { FormCheckbox } from "@/Components/ui/checkbox";
import { Input } from "@/Components/ui/input";

function Form() {
  const { t } = useLaravelReactI18n();
  const { data, setData, defaultData, disabled } = useFormPage(
    {
      date: new Date(),
    },
    { trackDefaultValue: false },
  );

  const widgetColumns = useMemo(() => {
    return [
      {
        name: "widget",
        titleTrans: "settings.dashboard.columns.widget",
        required: true,
        width: 3,
        cell({ dataRow, setData, attributes }) {
          return (
            <WidgetLinkModel
              value={dataRow?.widget}
              onValueChange={(val) => setData("widget", val)}
              {...attributes}
            />
          );
        },
      },
      {
        name: "width",
        titleTrans: "settings.dashboard.columns.width",
        required: true,
        type: "text",
        width: 2,
        cell({ data, setData, attributes }) {
          return (
            <Select
              value={data}
              onValueChange={(e) => setData("width", e)}
              optionTrans="settings.dashboard.columns.width.options"
              options={["half", "full"]}
              {...attributes}
            />
          );
        },
      },
      {
        name: "is_visible",
        titleTrans: "settings.dashboard.columns.is_visible",
        required: true,
        type: "text",
        width: 2,
        cell({ data, setData, dataRow }) {
          return (
            <FormCheckbox
              disabled={!dataRow.widget}
              checked={data}
              onCheckedChange={(e) => setData("is_visible", e)}
            />
          );
        },
      },
    ];
  }, [data, t]);
  return (
    <>
      <FormPageContent value="detail" title={t("settings.dashboard.detail")}>
        <div className="flex flex-col gap-y-4">
          <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
            <FormInput
              label={t("settings.dashboard.columns.title")}
              required
              name="title"
            >
              <Input
                value={data.title}
                onValueChange={(val) => setData("title", val)}
              />
            </FormInput>
          </div>
        </div>
      </FormPageContent>

      <FormPageContent value="detail" title={t("settings.dashboard.widgets")}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <div className="col-span-full">
            <FormTable
              readOnly={disabled}
              columns={widgetColumns}
              value={data?.widgets}
              onValueChange={(v) => setData("widgets", v)}
            />
          </div>
        </div>
      </FormPageContent>

      <FormPageContent
        value="detail"
        title={t("settings.dashboard.external_note")}
        collapsible
        defaultOpen={defaultData?.external_note}
      >
        <div className="px-1 py-1">
          <FormInput>
            <Textarea
              rows={3}
              value={data.external_note ?? ""}
              onChange={(e) => setData("external_note", e.target.value)}
            />
          </FormInput>
        </div>
      </FormPageContent>
    </>
  );
}

export default Form;
