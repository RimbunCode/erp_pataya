import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import { useEffect, useState } from "react";

import FormInput from "@/Components/FormInput";
import { useLaravelReactI18n } from "laravel-react-i18n";
import PermissionLinkModel from "@/Pages/Core/PermissionLinkModel";
import { Input } from "@/Components/ui/input";
import Select from "@/Components/Select";
import axios from "axios";
import useDidMountEffect from "@/Hooks/useDidMountEffect";
import { inArray } from "@/lib/utils";

export default function Form() {
  const { t } = useLaravelReactI18n();
  const { data, setData } = useFormPage(
    {},
    {
      trackDefaultValue: false,
    },
  );

  const [columns, setColumns] = useState([]);
  const calculationType = data?.calculation_type;
  const groupByType = data?.group_by_type;
  const modelClass = data?.model?.model;

  const getNameColumns = (types, isExcept = false) => {
    return columns
      .filter((x) => {
        types = Array.isArray(types) ? types : [types];
        return isExcept ? !inArray(types, x.type) : inArray(types, x.type);
      })
      .map((x) => ({ value: x.name, titleTrans: x.titleTrans }));
  };

  const isValidColumn = (name, ...types) =>
    !!name && getNameColumns(...types).some((x) => x.value === name);

  useEffect(() => {
    const reloadData = setTimeout(() => {
      if (!modelClass) {
        setColumns([]);
        setData("value_based_on", null);
        setData("aggregate_function_based_on", null);
        setData("time_based_on", null);
        return;
      }
      axios
        .get(window.route("model.columns", { model: modelClass }))
        .then((res) => {
          const data = res.data;
          setColumns(
            data?.columns?.filter(
              (x) =>
                !inArray(
                  [
                    "relation",
                    "relations",
                    "formStatus",
                    "formStatuses",
                    "mixed",
                  ],
                  x.type,
                ),
            ) ?? [],
          );
        })
        .catch((err) => {
          console.log(err);
        });
    }, 500);

    return () => clearTimeout(reloadData);
  }, [modelClass]);

  useDidMountEffect(() => {
    if (calculationType === "group_by") {
      setData("value_based_on", null);
      setData("timespan", null);
      setData("time_interval", null);
      setData("time_based_on", null);
      if (!groupByType) {
        setData("group_by_type", "count");
      }
      if (!data?.group_by_base_on) {
        setData("group_by_base_on", "monthly");
      }
      return;
    }

    setData("group_by_type", null);
    setData("group_by_base_on", null);
    setData("aggregate_function_based_on", null);

    if (calculationType === "sum" || calculationType === "average") return;
    setData("value_based_on", null);
  }, [calculationType]);

  useDidMountEffect(() => {
    if (groupByType === "count") {
      setData("aggregate_function_based_on", null);
    }
  }, [groupByType]);

  useDidMountEffect(() => {
    if (!isValidColumn(data?.value_based_on, "number")) {
      setData("value_based_on", null);
    }
    if (!isValidColumn(data?.aggregate_function_based_on, "number")) {
      setData("aggregate_function_based_on", null);
    }
    if (!isValidColumn(data?.time_based_on, "datetime")) {
      setData("time_based_on", null);
    }
  }, [columns]);

  return (
    <>
      <FormPageContent value="detail" title={t("settings.widget.details")}>
        <div className="grid gap-x-4 gap-y-4 md:grid-cols-2 ">
          <FormInput
            name="title"
            label={t("settings.widget.columns.title")}
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
            label={t("settings.widget.columns.calculation_type")}
            required
          >
            <Select
              value={data?.calculation_type}
              onValueChange={(val) => {
                setData("calculation_type", val);
              }}
              optionTrans="settings.widget.calculation_types"
              options={["sum", "average", "count", "group_by"]}
            />
          </FormInput>
          <FormInput
            name="type"
            label={t("settings.widget.columns.type")}
            required
          >
            <Select
              value={data?.type}
              onValueChange={(val) => {
                setData("type", val);
              }}
              optionTrans="settings.widget.types"
              options={[
                "bar",
                "pie",
                "line",
                "doughnut",
                ...(inArray(["sum", "count", "average"], data.calculation_type)
                  ? ["card"]
                  : []),
              ]}
            />
          </FormInput>
          <FormInput
            name="model"
            label={t("settings.widget.columns.model")}
            required
          >
            <PermissionLinkModel
              value={data.model}
              onValueChange={(val) => {
                setData("model", val);
              }}
            />
          </FormInput>
          {(data.calculation_type == "sum" ||
            data.calculation_type == "average") && (
            <FormInput
              name="value_based_on"
              label={t("settings.widget.columns.value_based_on")}
              disabled={!modelClass}
            >
              <Select
                value={data?.value_based_on}
                onValueChange={(val) => {
                  setData("value_based_on", val);
                }}
                optionTrans="settings.widget.value_based_ons"
                options={getNameColumns(["number", "currency"])}
              />
            </FormInput>
          )}

          {data.calculation_type == "group_by" && (
            <>
              <FormInput
                name="group_by_type"
                label={t("settings.widget.columns.group_by_types")}
                disabled={!modelClass}
              >
                <Select
                  value={data?.group_by_type}
                  onValueChange={(val) => {
                    setData("group_by_type", val);
                  }}
                  optionTrans="settings.widget.columns.group_by_types.options"
                  options={["count", "sum", "average"]}
                />
              </FormInput>
              <FormInput
                name="group_by_base_on"
                label={t("settings.widget.columns.group_by_base_on")}
                disabled={!modelClass}
              >
                <Select
                  value={data?.group_by_base_on}
                  onValueChange={(val) => {
                    setData("group_by_base_on", val);
                  }}
                  optionTrans="settings.widget.group_by_base_on.types"
                  options={getNameColumns("datetime", true)}
                />
              </FormInput>

              {data.calculation_type == "group_by" &&
                data.group_by_type != "count" && (
                  <FormInput
                    name="aggregate_function_based_on"
                    label={t(
                      "settings.widget.columns.aggregate_function_based_on",
                    )}
                    disabled={!modelClass}
                  >
                    <Select
                      value={data?.aggregate_function_based_on}
                      onValueChange={(val) => {
                        setData("aggregate_function_based_on", val);
                      }}
                      optionTrans="settings.widget.aggregate_function_based_ons"
                      options={getNameColumns("number")}
                    />
                  </FormInput>
                )}
            </>
          )}
        </div>
      </FormPageContent>

      {data.calculation_type != "group_by" && (
        <>
          <FormPageContent
            value="detail"
            title={t("settings.widget.time_series")}
          >
            <div className="grid gap-x-4 gap-y-4 md:grid-cols-2 ">
              {" "}
              <FormInput
                name="time_based_on"
                label={t("settings.widget.columns.time_based_on")}
                disabled={!modelClass}
              >
                <Select
                  value={data?.time_based_on}
                  onValueChange={(val) => {
                    setData("time_based_on", val);
                  }}
                  optionTrans="settings.widget.time_series_based_ons"
                  options={getNameColumns("datetime")}
                />
              </FormInput>
              <FormInput
                name="timespan"
                className="col-start-1"
                label={t("settings.widget.columns.timespan")}
                disabled={!modelClass}
              >
                <Select
                  value={data?.timespan}
                  onValueChange={(val) => {
                    setData("timespan", val);
                  }}
                  optionTrans="settings.widget.timespans"
                  options={[
                    "last_week",
                    "last_month",
                    "last_quarter",
                    "last_year",
                  ]}
                />
              </FormInput>
              <FormInput
                name="time_interval"
                className="col-start-2"
                label={t("settings.widget.columns.time_interval")}
                disabled={!modelClass}
              >
                <Select
                  value={data?.time_interval}
                  onValueChange={(val) => {
                    setData("time_interval", val);
                  }}
                  optionTrans="settings.widget.time_intervals"
                  options={[
                    "daily",
                    "weekly",
                    "monthly",
                    "quarterly",
                    "yearly",
                  ]}
                />
              </FormInput>
            </div>
          </FormPageContent>
        </>
      )}
    </>
  );
}
