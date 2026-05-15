import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import React, { memo } from "react";

import BranchLinkModel from "@/Pages/Settings/Branches/BranchLinkModel";
import FormInput from "@/Components/FormInput";
import FormStockLevels from "../Items/FormStockLevels";
import { Input } from "@/Components/ui/input";
import UserLinkModel from "@/Pages/Users/ManageUsers/UserLinkModel";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

export default memo(function Form() {
  const { data, setData } = useFormPage();
  const { t } = useLaravelReactI18n();
  const { branchSettings } = usePage().props;

  return (
    <>
      <FormPageContent title="Detail" value="detail">
        <div className="grid pt-2 gap-x-8 gap-y-4">
          {branchSettings?.currentBranch?.is_main_branch && (
            <FormInput label="Branch" required={true}>
              <BranchLinkModel
                placeholder={t(
                  "inventory.warehouse.columns.branch.placeholder",
                )}
                value={data.branch}
                onValueChange={(val) => setData("branch", val)}
                filters={{
                  branchable_type: null,
                  branchable_id: null,
                }}
              />
            </FormInput>
          )}
          <FormInput label="Code" required={true}>
            <Input
              value={data.code}
              onChange={(e) => setData("code", e.target.value)}
            />
          </FormInput>
          <FormInput label="Name" required={true}>
            <Input
              value={data.name}
              onChange={(e) => setData("name", e.target.value)}
            />
          </FormInput>
          <FormInput label="PIC">
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
