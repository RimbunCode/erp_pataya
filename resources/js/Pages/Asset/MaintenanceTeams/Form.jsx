import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";

import BranchLinkModel from "@/Pages/Settings/Branches/BranchLinkModel";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import { Input } from "@/Components/ui/input";
import React from "react";
import UserLinkModel from "@/Pages/Users/ManageUsers/UserLinkModel";
import { generateRandom } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useMemo } from "react";

export default function Form() {
  const { data, setData, disabled } = useFormPage();
  const { t } = useLaravelReactI18n();

  const memberColumns = useMemo(
    () => [
      {
        name: "user",
        titleTrans: "asset.maintenance.team.columns.manager",
        required: true,
        cell({ data: value, setData, attributes }) {
          return (
            <UserLinkModel
              value={value}
              onValueChange={(val) => setData("user", val)}
              {...attributes}
            />
          );
        },
      },
    ],
    [],
  );

  return (
    <FormPageContent title={t("asset.maintenance.team.title")} value="main">
      <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
        <FormInput
          name="team_name"
          required={true}
          label={t("asset.maintenance.team.columns.team_name")}
        >
          <Input
            value={data?.team_name ?? ""}
            onChange={(e) => setData("team_name", e.target.value)}
          />
        </FormInput>
        <FormInput
          name="manager"
          label={t("asset.maintenance.team.columns.manager")}
        >
          <UserLinkModel
            value={data?.manager}
            onValueChange={(val) => setData("manager", val)}
          />
        </FormInput>
        <FormInput
          name="branch"
          label={t("asset.maintenance.team.columns.branch")}
        >
          <BranchLinkModel
            value={data?.branch}
            onValueChange={(val) => setData("branch", val)}
          />
        </FormInput>
      </div>
      <div className="col-span-full">
        <FormTable
          name="MaintenanceTeamMembers"
          readOnly={disabled}
          columns={memberColumns}
          value={data?.members}
          onValueChange={(v) => setData("members", v)}
          mapItem={({ item }) => ({
            ...item,
            id: item.id ?? generateRandom(5),
          })}
        />
      </div>
    </FormPageContent>
  );
}
