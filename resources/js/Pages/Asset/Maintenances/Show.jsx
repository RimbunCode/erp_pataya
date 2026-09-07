import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";

import AssetLinkModel from "@/Pages/Asset/Assets/AssetLinkModel";
import AssetMaintenanceTeamLinkModel from "@/Pages/Asset/MaintenanceTeams/AssetMaintenanceTeamLinkModel";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import { Input } from "@/Components/ui/input";
import NumberInput from "@/Components/NumberInput";
import { Textarea } from "@/Components/ui/textarea";
import Link from "@/Components/Link";
import React from "react";
import UserLinkModel from "@/Pages/Users/ManageUsers/UserLinkModel";
import { generateRandom } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useMemo } from "react";

export default function Show() {
  const { data, setData, disabled } = useFormPage();
  const { t } = useLaravelReactI18n();
  const route = window.route;

  const taskColumns = useMemo(
    () => [
      {
        name: "task_name",
        titleTrans: "asset.maintenance.task.columns.task_name",
        required: true,
        cell({ data: value, setData, attributes }) {
          return (
            <Input
              value={value ?? ""}
              onChange={(e) => setData(e.target.value)}
              {...attributes}
            />
          );
        },
      },
      {
        name: "periodicity",
        titleTrans: "asset.maintenance.task.columns.periodicity",
        required: true,
        cell({ data: value, setData, attributes }) {
          return (
            <NumberInput
              allowDecimals={false}
              value={value}
              onValueChange={(val) => setData(val)}
              {...attributes}
            />
          );
        },
      },
      {
        name: "next_due_date",
        titleTrans: "asset.maintenance.task.columns.next_due_date",
        cell({ data: value }) {
          return <span>{value}</span>;
        },
      },
      {
        name: "description",
        titleTrans: "asset.maintenance.task.columns.description",
        cell({ data: value, setData, attributes }) {
          return (
            <Textarea
              rows={1}
              value={value ?? ""}
              onChange={(e) => setData(e.target.value)}
              {...attributes}
            />
          );
        },
      },
      {
        name: "assign_to",
        titleTrans: "asset.maintenance.task.columns.assign_to",
        cell({ data: value, setData, attributes }) {
          return (
            <UserLinkModel
              value={value}
              onValueChange={(val) => setData("assign_to", val)}
              {...attributes}
            />
          );
        },
      },
    ],
    [],
  );

  return (
    <FormPageContent title={t("asset.maintenance.title")} value="main">
      <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
        <FormInput
          name="asset"
          required={true}
          label={t("asset.maintenance.columns.asset")}
        >
          <AssetLinkModel
            value={data?.asset}
            onValueChange={(val) => setData("asset", val)}
          />
        </FormInput>
        <FormInput
          name="maintenanceTeam"
          label={t("asset.maintenance.columns.maintenanceTeam")}
        >
          <AssetMaintenanceTeamLinkModel
            value={data?.maintenanceTeam}
            onValueChange={(val) => setData("maintenanceTeam", val)}
          />
        </FormInput>
      </div>
      <div className="col-span-full">
        <FormTable
          name="AssetMaintenanceTasks"
          readOnly={disabled}
          columns={taskColumns}
          value={data?.tasks}
          onValueChange={(v) => setData("tasks", v)}
          mapItem={({ item }) => ({
            ...item,
            id: item.id ?? generateRandom(5),
          })}
        />
      </div>
      {data?.tasks?.some((task) => task.services?.length > 0) && (
        <div className="flex flex-col col-span-full gap-y-2">
          <p className="text-sm font-medium">{t("asset.service.title")}</p>
          {data.tasks.flatMap((task) =>
            (task.services ?? []).map((service) => (
              <Link
                key={service.id}
                as="button"
                href={route("assetServices.show", service.id)}
                className="flex items-center justify-between p-2 text-sm border rounded"
              >
                <span>{service.code}</span>
                <span className="text-muted-foreground">
                  {(service.status ?? [])
                    .map((s) => t(`status.${s}`))
                    .join(", ")}
                </span>
              </Link>
            )),
          )}
        </div>
      )}
    </FormPageContent>
  );
}
