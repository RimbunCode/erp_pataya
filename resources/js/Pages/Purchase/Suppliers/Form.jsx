import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import React, { useMemo } from "react";

import CountryLinkModel from "@/Pages/Core/CountryLinkModel";
import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import FormTable from "@/Components/FormTable";
import { Input } from "@/Components/ui/input";
import SupplierLinkModel from "./SupplierLinkModel";
import { Textarea } from "@/Components/ui/textarea";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Form() {
  const { data, setData } = useFormPage();
  const { t } = useLaravelReactI18n();
  /**
   * @typedef {import('@/Components/FormTable').ColumnProps} ColumnProps
   * @type {ColumnProps[]}
   */
  const banksColumns = useMemo(
    () => [
      {
        name: "bank",
        titleTrans: "purchase.supplier.columns.bank",
        required: true,
      },
      {
        name: "no_acc",
        titleTrans: "purchase.supplier.columns.no_acc",
        required: true,
      },
      {
        name: "account",
        titleTrans: "purchase.supplier.columns.account",
        required: true,
      },
    ],
    [],
  );
  return (
    <>
      <FormPageContent
        title={t("purchase.supplier.supplier_detail")}
        value="supplier_detail"
      >
        <FormCheckbox
          label={t("purchase.supplier.columns.is_disabled")}
          checked={data?.is_disabled}
          onCheckedChange={(e) => setData("is_disabled", e)}
        />
        <FormInput
          label={t("purchase.supplier.columns.name")}
          required={true}
          name="name"
          className="mt-4"
        >
          <Input
            value={data?.name ?? ""}
            onChange={(e) => setData("name", e.target.value)}
          />
        </FormInput>
        <FormInput
          label={t("purchase.supplier.columns.branch_of")}
          required={false}
          name="branch_of"
          className="mt-4"
        >
          <SupplierLinkModel
            disabled={data?.branches && data?.branches.length > 0}
            value={data.branch_of}
            onValueChange={(val) => setData("branch_of", val)}
            filters={{
              parent_id: null,
              id: {
                not: data?.id,
                notIn: data?.branches?.map((x) => x.id) ?? [],
              },
            }}
            disabledAddButton
          />
        </FormInput>
        <div className="grid pt-2 mt-4 gap-x-4 gap-y-4 md:grid-cols-2">
          <FormInput
            name="email"
            label={t("purchase.supplier.columns.email")}
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
            label={t("purchase.supplier.columns.phone")}
            required={true}
          >
            <Input
              value={data?.phone ?? ""}
              onChange={(e) => setData("phone", e.target.value)}
            />
          </FormInput>
        </div>
        <FormTable
          name="SupplierBankAccounts"
          label={t("purchase.supplier.columns.banks")}
          className="mt-4"
          columns={banksColumns}
          value={data.banks ?? []}
          onValueChange={(val) => {
            setData("banks", val);
          }}
        />
      </FormPageContent>
      <FormPageContent
        title={t("purchase.supplier.address")}
        value="supplier_detail"
      >
        <FormInput
          name="street"
          label={t("purchase.supplier.columns.street")}
          required={true}
          className="col-span-full"
        >
          <Textarea
            value={data?.street ?? ""}
            onChange={(e) => setData("street", e.target.value)}
          />
        </FormInput>

        <div className="grid pt-2 gap-x-8 gap-y-4 md:grid-cols-3">
          <FormInput
            name="city"
            label={t("purchase.supplier.columns.city")}
            required={true}
          >
            <Input
              value={data?.city ?? ""}
              onChange={(e) => setData("city", e.target.value)}
            />
          </FormInput>
          <FormInput
            name="province"
            label={t("purchase.supplier.columns.province")}
            required={true}
          >
            <Input
              value={data?.province ?? ""}
              onChange={(e) => setData("province", e.target.value)}
            />
          </FormInput>
          <FormInput
            name="zip_code"
            label={t("purchase.supplier.columns.zip_code")}
            required={true}
          >
            <Input
              value={data?.zip_code ?? ""}
              onChange={(e) => setData("zip_code", e.target.value)}
            />
          </FormInput>

          <FormInput
            name="country"
            label={t("purchase.supplier.columns.country")}
            required={true}
          >
            <CountryLinkModel
              placeholder={t("purchase.supplier.columns.country.placeholder")}
              value={data.country}
              onValueChange={(val) => setData("country", val)}
            />
          </FormInput>
        </div>
      </FormPageContent>
    </>
  );
}
