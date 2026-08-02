import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";

import AccountLinkModel from "../Accounts/AccountLinkModel";
import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import React from "react";
import { Textarea } from "@/Components/ui/textarea";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Form() {
  const { data, setData } = useFormPage();
  const { t } = useLaravelReactI18n();

  return (
    <>
      <FormPageContent title={null} value="detail">
        <div className="grid gap-x-3 gap-y-4">
          <FormInput
            name="name"
            required={true}
            label={t("finances.paymentMethod.columns.name")}
          >
            <Input
              value={data?.name ?? ""}
              onChange={(e) => setData("name", e.target.value)}
            />
          </FormInput>
          <FormInput
            name="default_account"
            label={t("finances.paymentMethod.columns.default_account")}
          >
            <AccountLinkModel
              filters={{
                root_type: "asset",
                is_group: false,
              }}
              value={data?.default_account ?? ""}
              onValueChange={(val) => setData("default_account", val)}
            />
          </FormInput>
          <FormInput
            name="description"
            label={t("finances.paymentMethod.columns.description")}
          >
            <Textarea
              value={data?.description ?? ""}
              onChange={(e) => setData("description", e.target.value)}
            />
          </FormInput>
        </div>
      </FormPageContent>
    </>
  );
}
