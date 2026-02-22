import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import React, { useState } from "react";

import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import { Textarea } from "@/Components/ui/textarea";
import { useLaravelReactI18n } from "laravel-react-i18n";
import PermissionLinkModel from "@/Pages/Core/PermissionLinkModel";
import { Input } from "@/Components/ui/input";
import Select from "@/Components/Select";
import axios from "axios";
import useDidMountEffect from "@/Hooks/useDidMountEffect";

export default function Form() {
  const { t } = useLaravelReactI18n();
  const { data, setData, defaultData } = useFormPage(
    {
      delivery_date: new Date(),
    },
    {
      trackDefaultValue: false,
    },
  );

  const [columns, setColumns] = useState([]);
  useDidMountEffect(() => {
    const reloadData = setTimeout(() => {
      if (!data.model) return;
      axios
        .get(window.route("model.columns", { model: data.model?.model }))
        .then((res) => {
          const data = res.data;
          console.log(data);
          // setColumns(data);
        })
        .catch((err) => {
          console.log(err);
        })
        .finally(() => {});
    }, 500);

    return () => clearTimeout(reloadData);
  }, [data.model]);
  return (
    <>
      <FormPageContent value="detail" title={t("core.widget.detail")}>
        <div className="grid gap-x-4 gap-y-4 md:grid-cols-2 [&>div]:grid [&>div]:gap-y-4 [&>div]:grid-cols-1 [&>div]:content-start">
          <div>
            <FormInput
              name="title"
              label={t("settings.dashboard_charts.columns.title")}
              required
            >
              <Input
                value={data?.title}
                onValueChange={(val) => {
                  setData("title", val);
                }}
              />
            </FormInput>
            <FormInput
              name="calculation_type"
              label={t("settings.dashboard_charts.columns.calculation_type")}
              required
            >
              <Select
                value={data?.calculation_type}
                onValueChange={(val) => {
                  setData("calculation_type", val);
                }}
                optionTrans="settings.dashboard_charts.calculation_types"
                options={["sum", "average", "count", "group_by"]}
              />
            </FormInput>
            <FormInput
              name="model"
              label={t("settings.dashboard_charts.columns.model")}
              required
            >
              <PermissionLinkModel
                value={data.model}
                onValueChange={(val) => {
                  setData("model", val);
                }}
              />
            </FormInput>
          </div>
          <FormInput
            name="time_series_based_on"
            label={t("settings.dashboard_charts.columns.time_series_based_on")}
            disabled={!data.model}
          >
            <Select
              value={data?.time_series_based_on}
              onValueChange={(val) => {
                setData("time_series_based_on", val);
              }}
              optionTrans="settings.dashboard_charts.time_series_based_ons"
              options={["created_on", "updated_on"]}
            />
          </FormInput>
          <FormInput
            name="time_interval"
            label={t("settings.dashboard_charts.columns.time_interval")}
            disabled={!data.model}
          >
            <Select
              value={data?.time_interval}
              onValueChange={(val) => {
                setData("time_interval", val);
              }}
              optionTrans="settings.dashboard_charts.time_intervals"
              options={["daily", "weekly", "monthly", "yearly"]}
            />
          </FormInput>
        </div>
      </FormPageContent>

      <FormPageContent
        value="detail"
        title={t("core.widget.columns.external_note")}
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
