import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";

import AssetLocationLinkModel from "./AssetLocationLinkModel";
import BranchLinkModel from "@/Pages/Settings/Branches/BranchLinkModel";
import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import React from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Form() {
  const { data, setData } = useFormPage();
  const { t } = useLaravelReactI18n();

  return (
    <>
      <FormPageContent title={null} value="detail">
        <div className="grid gap-x-3 gap-y-4">
          <FormInput
            name="location_name"
            required={true}
            label={t("asset.location.columns.location_name")}
          >
            <Input
              value={data?.location_name ?? ""}
              onChange={(e) => setData("location_name", e.target.value)}
            />
          </FormInput>
          <FormInput
            name="branch"
            required={true}
            label={t("asset.location.columns.branch")}
          >
            <BranchLinkModel
              placeholder={t("asset.location.columns.branch.placeholder")}
              value={data?.branch}
              onValueChange={(val) => setData("branch", val)}
            />
          </FormInput>
          <FormInput
            name="parent"
            label={t("asset.location.columns.parent_id")}
          >
            <AssetLocationLinkModel
              placeholder={t(
                "asset.location.columns.parent_id.placeholder",
              )}
              value={data?.parent}
              onValueChange={(val) => setData("parent", val)}
              filters={{
                id: { not: data?.id },
              }}
            />
          </FormInput>
          <FormCheckbox
            checked={data?.is_group ?? false}
            onCheckedChange={(val) => setData("is_group", val)}
          >
            {t("asset.location.columns.is_group")}
          </FormCheckbox>
        </div>
      </FormPageContent>
    </>
  );
}
