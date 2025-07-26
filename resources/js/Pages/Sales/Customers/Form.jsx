import {
  FormPageContent,
  FormPageContentTitle,
  useFormPage,
} from "@/Pages/Core/FormPage";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/Components/ui/select";

import BranchForm from "@/Pages/Settings/Branches/Form";
import { Button } from "@/Components/ui/button";
import CountryLinkModel from "@/Pages/Core/CountryLinkModel";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import { Input } from "@/Components/ui/input";
import React from "react";
import { Textarea } from "@/Components/ui/textarea";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Form() {
  const { t } = useLaravelReactI18n();
  const { data, setData } = useFormPage();

  return (
    <>
      <FormPageContent
        title={t("sales.customer.customer_detail")}
        value="customer_detail"
      >
        <FormInput
          label={t("sales.customer.columns.name")}
          required={true}
          name="name"
        >
          <Input
            value={data?.name ?? ""}
            onChange={(e) => setData("name", e.target.value)}
          />
        </FormInput>
        <div className="grid pt-2 mt-4 gap-x-4 gap-y-4 md:grid-cols-3">
          <FormInput label={t("sales.customer.columns.vat")} required={true}>
            <Input
              type="string"
              value={data?.vat ?? ""}
              onChange={(e) => setData("vat", e.target.value)}
            />
          </FormInput>
          <FormInput label={t("sales.customer.columns.email")} required={true}>
            <Input
              type="email"
              value={data?.email ?? ""}
              onChange={(e) => setData("email", e.target.value)}
            />
          </FormInput>
          <FormInput label={t("sales.customer.columns.phone")} required={true}>
            <Input
              value={data?.phone ?? ""}
              onChange={(e) => setData("phone", e.target.value)}
            />
          </FormInput>
          <FormInput
            label={t("sales.customer.columns.is_disabled")}
            required={true}
          >
            <Select
              value={data?.is_disabled ? "0" : "1"}
              onValueChange={(v) => setData("is_disabled", v === "0")}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t(
                    "sales.customer.columns.is_disabled.placeholder",
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">
                  {t("sales.customer.columns.is_disabled.options.active")}
                </SelectItem>
                <SelectItem value="0">
                  {t("sales.customer.columns.is_disabled.options.disabled")}
                </SelectItem>
              </SelectContent>
            </Select>
          </FormInput>
        </div>
      </FormPageContent>
      <FormPageContent
        title={t("sales.customer.address")}
        value="customer_detail"
      >
        <FormPageContentTitle>
          {t("sales.customer.address")}
        </FormPageContentTitle>
        <FormInput
          label={t("sales.customer.columns.street")}
          required={true}
          className="col-span-full"
        >
          <Textarea
            value={data?.street ?? ""}
            onChange={(e) => setData("street", e.target.value)}
          />
        </FormInput>

        <div className="grid pt-2 mt-4 gap-x-4 gap-y-4 md:grid-cols-3">
          <FormInput label={t("sales.customer.columns.city")} required={true}>
            <Input
              value={data?.city ?? ""}
              onChange={(e) => setData("city", e.target.value)}
            />
          </FormInput>
          <FormInput
            label={t("sales.customer.columns.province")}
            required={true}
          >
            <Input
              value={data?.province ?? ""}
              onChange={(e) => setData("province", e.target.value)}
            />
          </FormInput>
          <FormInput
            label={t("sales.customer.columns.zip_code")}
            required={true}
          >
            <Input
              value={data?.zip_code ?? ""}
              onChange={(e) => setData("zip_code", e.target.value)}
            />
          </FormInput>

          <FormInput
            label={t("sales.customer.columns.country")}
            required={true}
          >
            <CountryLinkModel
              placeholder={t("sales.customer.columns.country.placeholder")}
              value={data.country}
              onValueChange={(val) => setData("country", val)}
            />
          </FormInput>
        </div>
      </FormPageContent>
      <FormPageContent title={t("sales.customer.branches")} value="branches">
        <FormTable
          columns={[
            {
              name: "branch_name",
              title: t("sales.customer.columns.branch_name"),
              required: true,
              cell: ({ dataRow, openDialog, isEmpty }) => {
                if (dataRow.is_main_branch) {
                  return (
                    <div className="flex self-start justify-start px-4 py-2 custom-cell">
                      <p>{dataRow.name} (Main Branch)</p>
                    </div>
                  );
                }
                return (
                  <div className="flex self-start justify-start px-4 py-2 custom-cell">
                    {isEmpty ? (
                      <Button size="sm" className="h-8" onClick={openDialog}>
                        {t("core.branch.add_branch")}
                      </Button>
                    ) : (
                      <p
                        className="cursor-pointer hover:underline"
                        onClick={openDialog}
                      >
                        {dataRow.name ?? t("core.branch.empty")}
                      </p>
                    )}
                  </div>
                );
              },
            },
          ]}
          submitable
          defaultValueRow={{
            branchable_type: "App\\Models\\Sales\\Customer",
          }}
          value={data.branches ?? []}
          onValueChange={(val) => {
            setData("branches", val);
          }}
          form={<BranchForm />}
        />
      </FormPageContent>
    </>
  );
}
