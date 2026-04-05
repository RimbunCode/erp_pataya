import {
  FormPageContent,
  FormPageContentTitle,
  useFormPage,
} from "@/Pages/Core/FormPage";

import CountryLinkModel from "@/Pages/Core/CountryLinkModel";
import { FormCheckbox } from "@/Components/ui/checkbox";
import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import React from "react";
import Select from "@/Components/Select";
import { Textarea } from "@/Components/ui/textarea";
import { memo } from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default memo(function Form() {
  const { data, setData } = useFormPage();
  const { t } = useLaravelReactI18n();
  return (
    <>
      <FormPageContent
        title={t("core.branch.branch_detail")}
        value="branch_detail"
      >
        <div className="grid pt-2 gap-x-4 gap-y-4 md:grid-cols-2">
          <FormInput
            label={t("core.branch.columns.code")}
            required={true}
            name="code"
          >
            <Input
              value={data.code ?? ""}
              onChange={(e) => setData("code", e.target.value)}
            />
          </FormInput>
          <FormInput
            label={t("core.branch.columns.name")}
            required={true}
            name="name"
          >
            <Input
              value={data.name ?? ""}
              onChange={(e) => setData("name", e.target.value)}
            />
          </FormInput>
          <FormCheckbox
            checked={data.is_disabled}
            onCheckedChange={(val) => {
              setData("is_disabled", val);
            }}
            label={t("core.branch.columns.is_disabled.options.disabled")}
            className="col-start-1 flex items-center **:pointer-events-auto!"
          />
        </div>
      </FormPageContent>
      <FormPageContent
        title={t(
          data?.branchable_type
            ? "core.branch.columns.shipping_address"
            : "core.branch.columns.address",
        )}
        value="branch_detail"
      >
        <div className="grid pt-2 gap-x-4 gap-y-4 md:grid-cols-3">
          <FormInput
            label={t("core.branch.columns.street")}
            required={true}
            className="col-span-full"
          >
            <Textarea
              value={data.shipping_street ?? ""}
              onChange={(e) => setData("shipping_street", e.target.value)}
            />
          </FormInput>
          <FormInput label={t("core.branch.columns.city")} required={true}>
            <Input
              value={data.shipping_city ?? ""}
              onChange={(e) => setData("shipping_city", e.target.value)}
            />
          </FormInput>
          <FormInput label={t("core.branch.columns.state")} required={true}>
            <Input
              value={data.shipping_state ?? ""}
              onChange={(e) => setData("shipping_state", e.target.value)}
            />
          </FormInput>
          <FormInput label={t("core.branch.columns.zip_code")} required={true}>
            <Input
              value={data.shipping_zip_code ?? ""}
              onChange={(e) => setData("shipping_zip_code", e.target.value)}
            />
          </FormInput>
          <FormInput label={t("core.branch.columns.country")} required={true}>
            <CountryLinkModel
              placeholder={t("core.branch.columns.country.placeholder")}
              value={data.shipping_country ?? ""}
              onValueChange={(val) => setData("shipping_country", val)}
            />
          </FormInput>
        </div>
      </FormPageContent>
      {data?.branchable_type && (
        <FormPageContent
          title={t("core.branch.columns.billing_address")}
          value="branch_detail"
        >
          <FormPageContentTitle className="flex items-center justify-between">
            <h1 className="flex-1">
              {t("core.branch.columns.billing_address")}
            </h1>
            <Select
              className="w-fit"
              required={true}
              value={data.billing_address}
              onValueChange={(val) => {
                setData("billing_address", val);
              }}
              placeholder={t("core.branch.columns.billing_address.placeholder")}
              optionTrans="core.branch.columns.billing_address.options"
              defaultValue="same_main"
              options={["same_main", "same_shipping", "separate"]}
            />
          </FormPageContentTitle>
          {data?.billing_address == "separate" && (
            <div className="grid pt-2 gap-x-4 gap-y-4 md:grid-cols-3">
              <FormInput
                label={t("core.branch.columns.street")}
                required={true}
                className="col-span-full"
              >
                <Textarea
                  value={data.billing_street ?? ""}
                  onChange={(e) => setData("billing_street", e.target.value)}
                />
              </FormInput>
              <FormInput label={t("core.branch.columns.city")} required={true}>
                <Input
                  value={data.billing_city ?? ""}
                  onChange={(e) => setData("billing_city", e.target.value)}
                />
              </FormInput>
              <FormInput label={t("core.branch.columns.state")} required={true}>
                <Input
                  value={data.billing_state ?? ""}
                  onChange={(e) => setData("billing_state", e.target.value)}
                />
              </FormInput>
              <FormInput
                label={t("core.branch.columns.zip_code")}
                required={true}
              >
                <Input
                  value={data.billing_zip_code ?? ""}
                  onChange={(e) => setData("billing_zip_code", e.target.value)}
                />
              </FormInput>
              <FormInput
                label={t("core.branch.columns.country")}
                required={true}
              >
                <CountryLinkModel
                  placeholder={t("core.branch.columns.country.placeholder")}
                  value={data.billing_country}
                  onValueChange={(val) => setData("billing_country", val)}
                />
              </FormInput>
            </div>
          )}
        </FormPageContent>
      )}
    </>
  );
});
