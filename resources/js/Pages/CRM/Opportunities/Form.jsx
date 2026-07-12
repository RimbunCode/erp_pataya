import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";

import CustomerLinkModel from "@/Pages/Sales/Customers/CustomerLinkModel";
import DatetimePicker from "@/Components/DatetimePicker";
import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import LeadLinkModel from "@/Pages/CRM/Leads/LeadLinkModel";
import NumberInput from "@/Components/NumberInput";
import React from "react";
import Select from "@/Components/Select";
import { Textarea } from "@/Components/ui/textarea";
import UserLinkModel from "@/Pages/Users/ManageUsers/UserLinkModel";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Form() {
  const { t } = useLaravelReactI18n();
  const { data, setData } = useFormPage();

  return (
    <>
      <FormPageContent
        title={t("crm.opportunity.opportunity_detail")}
        value="opportunity_detail"
      >
        <FormInput
          label={t("crm.opportunity.columns.title")}
          required={true}
          name="title"
        >
          <Input
            value={data?.title ?? ""}
            onChange={(e) => setData("title", e.target.value)}
          />
        </FormInput>
        <div className="grid pt-2 mt-4 gap-x-4 gap-y-4 md:grid-cols-3">
          <FormInput label={t("crm.opportunity.columns.lead")}>
            <LeadLinkModel
              placeholder={t("crm.opportunity.columns.lead.placeholder")}
              value={data?.lead}
              onValueChange={(val) => setData("lead", val)}
            />
          </FormInput>
          <FormInput label={t("crm.opportunity.columns.customer")}>
            <CustomerLinkModel
              placeholder={t("crm.opportunity.columns.customer.placeholder")}
              value={data?.customer}
              onValueChange={(val) => setData("customer", val)}
            />
          </FormInput>
          <FormInput
            label={t("crm.opportunity.columns.stage")}
            required={true}
          >
            <Select
              value={data?.stage}
              onValueChange={(val) => setData("stage", val)}
              placeholder={t("crm.opportunity.columns.stage.placeholder")}
              optionTrans="crm.opportunity.columns.stage.options"
              defaultValue="identified"
              options={[
                "identified",
                "qualified",
                "negotiation",
                "won",
                "lost",
              ]}
            />
          </FormInput>
          <FormInput label={t("crm.opportunity.columns.expected_value")}>
            <NumberInput
              decimalScale={2}
              value={data?.expected_value}
              onValueChange={(val) => setData("expected_value", val)}
            />
          </FormInput>
          <FormInput label={t("crm.opportunity.columns.probability")}>
            <NumberInput
              suffix="%"
              min={0}
              max={100}
              value={data?.probability}
              onValueChange={(val) => setData("probability", val)}
            />
          </FormInput>
          <FormInput label={t("crm.opportunity.columns.expected_close_date")}>
            <DatetimePicker
              type="date"
              value={data?.expected_close_date}
              onValueChange={(val) => setData("expected_close_date", val)}
            />
          </FormInput>
          <FormInput label={t("crm.opportunity.columns.assigned_to")}>
            <UserLinkModel
              placeholder={t("crm.opportunity.columns.assigned_to.placeholder")}
              value={data?.assigned_to}
              onValueChange={(val) => setData("assigned_to", val)}
            />
          </FormInput>
        </div>
        <FormInput
          label={t("crm.opportunity.columns.notes")}
          className="col-span-full mt-4"
        >
          <Textarea
            value={data?.notes ?? ""}
            onChange={(e) => setData("notes", e.target.value)}
          />
        </FormInput>
      </FormPageContent>
    </>
  );
}
