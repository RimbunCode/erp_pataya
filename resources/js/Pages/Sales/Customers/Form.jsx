import {
  FormPageContent,
  FormPageContentTitle,
  useFormPage,
} from "@/Pages/Core/FormPage";

import BranchForm from "@/Pages/Settings/Branches/Form";
import { Button } from "@/Components/ui/button";
import CountryLinkModel from "@/Pages/Core/CountryLinkModel";
import { FormCheckbox } from "@/Components/ui/checkbox";
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
          <FormInput
            name="vat"
            label={t("sales.customer.columns.vat")}
            required={true}
          >
            <Input
              type="string"
              value={data?.vat ?? ""}
              onChange={(e) => setData("vat", e.target.value)}
            />
          </FormInput>
          <FormInput
            name="email"
            label={t("sales.customer.columns.email")}
            required={true}
          >
            <Input
              type="email"
              value={data?.email ?? ""}
              onChange={(e) => setData("email", e.target.value)}
            />
          </FormInput>
          <FormInput
            name="phone"
            label={t("sales.customer.columns.phone")}
            required={true}
          >
            <Input
              value={data?.phone ?? ""}
              onChange={(e) => setData("phone", e.target.value)}
            />
          </FormInput>
          <FormCheckbox
            label={t("purchase.supplier.columns.is_disabled")}
            checked={data?.is_disabled}
            onCheckedChange={(e) => setData("is_disabled", e)}
          />
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
          name="street"
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
          <FormInput
            name="city"
            label={t("sales.customer.columns.city")}
            required={true}
          >
            <Input
              value={data?.city ?? ""}
              onChange={(e) => setData("city", e.target.value)}
            />
          </FormInput>
          <FormInput
            name="province"
            label={t("sales.customer.columns.province")}
            required={true}
          >
            <Input
              value={data?.province ?? ""}
              onChange={(e) => setData("province", e.target.value)}
            />
          </FormInput>
          <FormInput
            name="zip_code"
            label={t("sales.customer.columns.zip_code")}
            required={true}
          >
            <Input
              value={data?.zip_code ?? ""}
              onChange={(e) => setData("zip_code", e.target.value)}
            />
          </FormInput>

          <FormInput
            name="country"
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
          name="CustomerBranches"
          columns={[
            {
              name: "branch_name",
              title: t("sales.customer.columns.branch_name"),
              required: true,
              cell: ({ dataRow, toggleDialog, isEmpty }) => {
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
                      <Button
                        size="sm"
                        className="h-8"
                        onClick={toggleDialog}
                        type="button"
                      >
                        {t("core.branch.add_branch")}
                      </Button>
                    ) : (
                      <p
                        className="cursor-pointer hover:underline"
                        onClick={toggleDialog}
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
          classNameDialog="max-w-(--breakpoint-2xl)!"
        />
      </FormPageContent>
    </>
  );
}
