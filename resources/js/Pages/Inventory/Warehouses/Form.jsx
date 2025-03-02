/* eslint-disable jsdoc/require-jsdoc */
import Combobox from "@/Components/Combobox";
import { CommandItem } from "@/Components/ui/command";
import FormInput from "@/Components/FormInput";
import { FormPageContent } from "@/Pages/Core/FormPage";
import { Input } from "@/Components/ui/input";
import React from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

export default function Form({ data, setData }) {
  const { branches } = usePage().props;
  const { t } = useLaravelReactI18n();
  return (
    <FormPageContent title="Detail" value="detail">
      <div className="grid pt-2 gap-x-8 gap-y-4">
        <FormInput label="Branch" required={true}>
          <Combobox
            options={branches}
            value={data.branch_id}
            placeholder={t("inventory.warehouse.columns.branch.placeholder")}
            templateTrigger={(branch_id) => {
              const country = branches?.find((c) => c.id === branch_id);
              return <span>{country?.name}</span>;
            }}
            templateItem={(branch) => {
              return (
                <CommandItem
                  key={branch.id}
                  value={`${branch.name} ${branch.id}`}
                  keywords={[branch.id, branch.name]}
                  onSelect={() => {
                    setData("branch_id", branch.id);
                  }}
                  className="block px-4 "
                >
                  {branch.name}
                </CommandItem>
              );
            }}
          />
        </FormInput>
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
      </div>
    </FormPageContent>
  );
}
