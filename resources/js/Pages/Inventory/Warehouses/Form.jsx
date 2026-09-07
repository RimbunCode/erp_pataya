import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import React, { memo } from "react";

import BranchLinkModel from "@/Pages/Settings/Branches/BranchLinkModel";
import FormInput from "@/Components/FormInput";
import FormStockLevels from "../Items/FormStockLevels";
import { Input } from "@/Components/ui/input";
import UserLinkModel from "@/Pages/Users/ManageUsers/UserLinkModel";
import useBranchFieldAccess from "@/Hooks/useBranchFieldAccess";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default memo(function Form() {
  const { currentBranch, isLocked, filters } = useBranchFieldAccess();
  const { data, setData } = useFormPage({ branch: currentBranch });
  const { t } = useLaravelReactI18n();

  return (
    <>
      <FormPageContent title="Detail" value="detail">
        <div className="grid pt-2 gap-x-8 gap-y-4">
          <FormInput name="branch" label="Branch" required={true}>
            <BranchLinkModel
              placeholder={t("inventory.warehouse.columns.branch.placeholder")}
              value={data.branch}
              onValueChange={(val) => setData("branch", val)}
              disabled={isLocked}
              filters={filters}
            />
          </FormInput>
          <FormInput name="code" label="Code" required={true}>
            <Input
              value={data.code}
              onChange={(e) => setData("code", e.target.value)}
            />
          </FormInput>
          <FormInput name="name" label="Name" required={true}>
            <Input
              value={data.name}
              onChange={(e) => setData("name", e.target.value)}
            />
          </FormInput>
          <FormInput name="pic" label="PIC">
            <UserLinkModel
              placeholder={t("inventory.warehouse.columns.pic.placeholder")}
              value={data.pic}
              onValueChange={(val) => setData("pic", val)}
            />
          </FormInput>
        </div>
      </FormPageContent>
      <FormStockLevels />
    </>
  );
});
