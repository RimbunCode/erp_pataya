import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import { useEffect, useMemo, useState } from "react";

import AssignableLinkModel from "@/Pages/Users/ManageUsers/AssignableLinkModel";
import ColorInput from "@/Components/ColorInput";
import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import { Input } from "@/Components/ui/input";
import PermissionLinkModel from "@/Pages/Core/PermissionLinkModel";
import Select from "@/Components/Select";
import axios from "axios";
import { useLaravelReactI18n } from "laravel-react-i18n";

// Feedback user: `chart_source_type` (count/sum/average/group_by/custom)
// TERPISAH TOTAL dari `visual_type` (line/bar/pie/donut/percentage/heatmap)
// — group_by BUKAN dibucket per waktu (fix bug lama ChartService/
// WidgetController::getChartData() yang selalu jatuh ke count-by-time).
export default function Form() {
  const { t } = useLaravelReactI18n();
  // Bug sama seperti Settings/NumberCard/Form.jsx: default sungguhan lewat
  // parameter `useFormPage` (survive restore draft localStorage), bukan
  // fallback display-only maupun `useEffect` ad-hoc (kalah lawan restore).
  const { data, setData } = useFormPage(
    { chart_source_type: "count" },
    { trackDefaultValue: false },
  );

  const [columns, setColumns] = useState([]);
  const chartSourceType = data?.chart_source_type ?? "count";
  const isGroupBy = chartSourceType === "group_by";
  const isCustom = chartSourceType === "custom";
  const isHeatmap = data?.visual_type === "heatmap";
  const modelClass = data?.model?.model;

  const getNameColumns = (types, isExcept = false) => {
    const typeList = Array.isArray(types) ? types : [types];
    return columns
      .filter((x) => (isExcept ? !typeList.includes(x.type) : typeList.includes(x.type)))
      .map((x) => ({ value: x.name, titleTrans: x.titleTrans }));
  };

  useEffect(() => {
    const reloadData = setTimeout(() => {
      if (!modelClass) {
        setColumns([]);
        return;
      }
      axios
        .get(window.route("model.columns", { model: modelClass }))
        .then((res) => setColumns(res.data?.columns ?? []))
        .catch((err) => console.log(err));
    }, 500);

    return () => clearTimeout(reloadData);
  }, [modelClass]);

  const nestedColumns = useMemo(
    () => [
      {
        name: "assignable",
        title: "Role / User",
        required: true,
        cell({ data: rowData, setData: setRowData, attributes }) {
          return (
            <AssignableLinkModel
              value={rowData}
              onValueChange={(val) => setRowData("assignable", val)}
              {...attributes}
            />
          );
        },
      },
    ],
    [],
  );

  return (
    <>
      <FormPageContent value="detail" title={t("settings.chart.details")}>
        <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
          <FormInput name="chart_name" label={t("settings.chart.columns.chart_name")} required>
            <Input value={data?.chart_name} onValueChange={(val) => setData("chart_name", val)} />
          </FormInput>
          <FormInput name="chart_source_type" label={t("settings.chart.columns.chart_source_type")} required>
            <Select
              value={chartSourceType}
              onValueChange={(val) => setData("chart_source_type", val)}
              optionTrans="settings.chart.chart_source_types"
              options={["count", "sum", "average", "group_by", "custom"]}
            />
          </FormInput>
          <FormInput name="visual_type" label={t("settings.chart.columns.visual_type")} required>
            <Select
              value={data?.visual_type}
              onValueChange={(val) => setData("visual_type", val)}
              optionTrans="settings.chart.visual_types"
              options={["line", "bar", "pie", "donut", "percentage", ...(isGroupBy ? [] : ["heatmap"])]}
            />
          </FormInput>

          {!isCustom && (
            <FormInput name="model" label={t("settings.chart.columns.model")} required>
              <PermissionLinkModel value={data.model} onValueChange={(val) => setData("model", val)} />
            </FormInput>
          )}

          {isCustom && (
            <FormInput name="method" label="Custom Source">
              <Input value={data?.method} onValueChange={(val) => setData("method", val)} />
            </FormInput>
          )}

          {!isCustom && (chartSourceType === "sum" || chartSourceType === "average") && (
            <FormInput name="value_based_on" label={t("settings.chart.columns.value_based_on")} disabled={!modelClass}>
              <Select
                value={data?.value_based_on}
                onValueChange={(val) => setData("value_based_on", val)}
                options={getNameColumns(["number", "currency"])}
              />
            </FormInput>
          )}

          {isGroupBy && (
            <>
              <FormInput name="group_by_based_on" label={t("settings.chart.columns.group_by_based_on")} disabled={!modelClass} required>
                <Select
                  value={data?.group_by_based_on}
                  onValueChange={(val) => setData("group_by_based_on", val)}
                  options={getNameColumns(["relations", "mixed", "json"], true)}
                />
              </FormInput>
              <FormInput name="group_by_type" label={t("settings.chart.columns.group_by_type")} disabled={!modelClass} required>
                <Select
                  value={data?.group_by_type}
                  onValueChange={(val) => setData("group_by_type", val)}
                  optionTrans="settings.chart.group_by_types"
                  options={["count", "sum", "average"]}
                />
              </FormInput>
              {data?.group_by_type && data.group_by_type !== "count" && (
                <FormInput
                  name="aggregate_function_based_on"
                  label={t("settings.chart.columns.aggregate_function_based_on")}
                  disabled={!modelClass}
                >
                  <Select
                    value={data?.aggregate_function_based_on}
                    onValueChange={(val) => setData("aggregate_function_based_on", val)}
                    options={getNameColumns("number")}
                  />
                </FormInput>
              )}
              <FormInput name="number_of_groups" label={t("settings.chart.columns.number_of_groups")}>
                <Input type="number" value={data?.number_of_groups} onValueChange={(val) => setData("number_of_groups", val)} />
              </FormInput>
            </>
          )}

          <FormInput name="color" label={t("settings.chart.columns.color")}>
            <ColorInput value={data?.color} onValueChange={(val) => setData("color", val)} />
          </FormInput>
          <FormInput name="currency" label={t("settings.chart.columns.currency")}>
            <Input value={data?.currency} onValueChange={(val) => setData("currency", val)} />
          </FormInput>
        </div>
      </FormPageContent>

      {!isGroupBy && !isCustom && (
        <FormPageContent value="detail" title={t("settings.chart.time_series")}>
          {isHeatmap ? (
            <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
              <FormInput name="heatmap_year" label={t("settings.chart.columns.heatmap_year")}>
                <Input type="number" value={data?.heatmap_year} onValueChange={(val) => setData("heatmap_year", val)} />
              </FormInput>
            </div>
          ) : (
            <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
              <FormInput name="based_on" label={t("settings.chart.columns.based_on")} disabled={!modelClass} required>
                <Select
                  value={data?.based_on}
                  onValueChange={(val) => setData("based_on", val)}
                  options={getNameColumns("datetime")}
                />
              </FormInput>
              <FormInput name="timespan" className="col-start-1" label={t("settings.chart.columns.timespan")}>
                <Select
                  value={data?.timespan}
                  onValueChange={(val) => setData("timespan", val)}
                  optionTrans="settings.chart.timespans"
                  options={["last_week", "last_month", "last_quarter", "last_year"]}
                />
              </FormInput>
              <FormInput name="time_interval" className="col-start-2" label={t("settings.chart.columns.time_interval")}>
                <Select
                  value={data?.time_interval}
                  onValueChange={(val) => setData("time_interval", val)}
                  optionTrans="settings.chart.time_intervals"
                  options={["daily", "weekly", "monthly", "quarterly", "yearly"]}
                />
              </FormInput>
            </div>
          )}
        </FormPageContent>
      )}

      <FormPageContent value="detail" title={t("settings.chart.sharing")}>
        <FormCheckbox
          label={t("settings.chart.columns.is_shared_all")}
          description={t("settings.chart.descriptions.is_shared_all")}
          checked={data?.is_shared_all ?? false}
          onCheckedChange={(val) => setData("is_shared_all", val)}
        />
        {!data?.is_shared_all && (
          <FormTable
            name="ChartAssignables"
            label="Bagikan ke Role/User"
            className="mt-2"
            columns={nestedColumns}
            value={data?.assignables ?? []}
            onValueChange={(val) => setData("assignables", val)}
          />
        )}
      </FormPageContent>
    </>
  );
}
