import { useLaravelReactI18n } from "laravel-react-i18n";
import React, { useMemo } from "react";
import { FormPageContent, useFormPage } from "../Core/FormPage";
import DashboardLinkModel from "../Settings/Dashboard/DashboardLinkModel";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";

function DashboardForm() {
  const { t } = useLaravelReactI18n();
  const { data, setData, defaultData, disabled } = useFormPage(
    {
      date: new Date(),
    },
    { trackDefaultValue: false },
  );

  const dashboardColumns = useMemo(() => {
    return [
      {
        name: "dashboard",
        titleTrans: "settings.dashboard.columns.dashboard",
        required: true,
        width: 3,
        cell({ dataRow, setData, attributes }) {
          return (
            <DashboardLinkModel
              value={dataRow?.dashboard}
              onValueChange={(val) => setData("dashboard", val)}
              {...attributes}
            />
          );
        },
      },
    ];
  }, [data, t]);
  return (
    <>
      <FormPageContent value="detail" title={null}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <div className="col-span-full">
            <FormTable
              readOnly={disabled}
              columns={dashboardColumns}
              value={data?.dashboards}
              onValueChange={(v) => setData("dashboards", v)}
            />
          </div>
        </div>
      </FormPageContent>
    </>
  );
}

export default DashboardForm;
