import {
  FormPageContent,
  FormPageContentTitle,
  useFormPage,
} from "@/Pages/Core/FormPage";

import CountryLinkModel from "@/Pages/Core/CountryLinkModel";
import FormInput from "@/Components/FormInput";
import LeadActivities from "./LeadActivities";
import LeadSourceLinkModel from "@/Pages/Core/LeadSourceLinkModel";
import { Input } from "@/Components/ui/input";
import React from "react";
import Select from "@/Components/Select";
import { Textarea } from "@/Components/ui/textarea";
import UserLinkModel from "@/Pages/Users/ManageUsers/UserLinkModel";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Form() {
  const { t } = useLaravelReactI18n();
  const { data, setData } = useFormPage();

  const isConverted = data?.status === "converted";

  return (
    <>
      <FormPageContent title={t("crm.lead.lead_detail")} value="lead_detail">
        <FormInput
          label={t("crm.lead.columns.company_name")}
          required={true}
          name="company_name"
        >
          <Input
            value={data?.company_name ?? ""}
            onChange={(e) => setData("company_name", e.target.value)}
          />
        </FormInput>
        <div className="grid pt-2 mt-4 gap-x-4 gap-y-4 md:grid-cols-3">
          <FormInput
            name="contact_name"
            label={t("crm.lead.columns.contact_name")}
          >
            <Input
              value={data?.contact_name ?? ""}
              onChange={(e) => setData("contact_name", e.target.value)}
            />
          </FormInput>
          <FormInput name="email" label={t("crm.lead.columns.email")}>
            <Input
              type="email"
              value={data?.email ?? ""}
              onChange={(e) => setData("email", e.target.value)}
            />
          </FormInput>
          <FormInput name="phone" label={t("crm.lead.columns.phone")}>
            <Input
              value={data?.phone ?? ""}
              onChange={(e) => setData("phone", e.target.value)}
            />
          </FormInput>
          <FormInput
            name="status"
            label={t("crm.lead.columns.status")}
            required={true}
          >
            <Select
              value={data?.status}
              onValueChange={(val) => setData("status", val)}
              placeholder={t("crm.lead.columns.status.placeholder")}
              optionTrans="crm.lead.columns.status.options"
              defaultValue="new"
              options={[
                "new",
                "contacted",
                "qualified",
                "unqualified",
                "converted",
              ]}
              disabled={isConverted}
            />
          </FormInput>
          <FormInput
            name="lead_source"
            label={t("crm.lead.columns.lead_source")}
          >
            <LeadSourceLinkModel
              placeholder={t("crm.lead.columns.lead_source.placeholder")}
              value={data?.lead_source}
              onValueChange={(val) => setData("lead_source", val)}
            />
          </FormInput>
          <FormInput
            name="assigned_to"
            label={t("crm.lead.columns.assigned_to")}
          >
            <UserLinkModel
              placeholder={t("crm.lead.columns.assigned_to.placeholder")}
              value={data?.assigned_to}
              onValueChange={(val) => setData("assigned_to", val)}
            />
          </FormInput>
        </div>
        <FormInput
          name="notes"
          label={t("crm.lead.columns.notes")}
          className="col-span-full mt-4"
        >
          <Textarea
            value={data?.notes ?? ""}
            onChange={(e) => setData("notes", e.target.value)}
          />
        </FormInput>
      </FormPageContent>
      <FormPageContent title={t("crm.lead.address")} value="lead_detail">
        <FormPageContentTitle>{t("crm.lead.address")}</FormPageContentTitle>
        <FormInput
          name="street"
          label={t("crm.lead.columns.street")}
          className="col-span-full"
        >
          <Textarea
            value={data?.street ?? ""}
            onChange={(e) => setData("street", e.target.value)}
          />
        </FormInput>
        <div className="grid pt-2 mt-4 gap-x-4 gap-y-4 md:grid-cols-3">
          <FormInput name="city" label={t("crm.lead.columns.city")}>
            <Input
              value={data?.city ?? ""}
              onChange={(e) => setData("city", e.target.value)}
            />
          </FormInput>
          <FormInput name="province" label={t("crm.lead.columns.province")}>
            <Input
              value={data?.province ?? ""}
              onChange={(e) => setData("province", e.target.value)}
            />
          </FormInput>
          <FormInput name="zip_code" label={t("crm.lead.columns.zip_code")}>
            <Input
              value={data?.zip_code ?? ""}
              onChange={(e) => setData("zip_code", e.target.value)}
            />
          </FormInput>
          <FormInput name="country" label={t("crm.lead.columns.country")}>
            <CountryLinkModel
              placeholder={t("crm.lead.columns.country.placeholder")}
              value={data?.country}
              onValueChange={(val) => setData("country", val)}
            />
          </FormInput>
        </div>
      </FormPageContent>
      <LeadActivities
        value={data?.activities ?? []}
        onValueChange={(val) => setData("activities", val)}
      />
    </>
  );
}
