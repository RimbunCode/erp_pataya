import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";
import QuotationItems from "./QuotationItems";
import QuotationSections, {
  copyTemplatesToSections,
  templatesForType,
} from "./QuotationSections";
import React, { useMemo } from "react";

import CustomerLinkModel from "@/Pages/Sales/Customers/CustomerLinkModel";
import DatetimePicker from "@/Components/DatetimePicker";
import FormInput from "@/Components/FormInput";
import { Input } from "@/Components/ui/input";
import LinkModel from "@/Components/LinkModel";
import NumberInput from "@/Components/NumberInput";
import OpportunityLinkModel from "@/Pages/CRM/Opportunities/OpportunityLinkModel";
import Select from "@/Components/Select";
import { Textarea } from "@/Components/ui/textarea";
import { calculateArray } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

// Daftar jenis ditulis di sini dan labelnya di berkas bahasa (pola discount_on
// pada SalesOrder), bukan Enum PHP.
const QUOTATION_TYPES = ["spare_part", "new_unit", "rental"];

export default function Form() {
  const { t } = useLaravelReactI18n();
  const sectionTemplates = usePage().props.sectionTemplates;
  const { data, setData, disabled } = useFormPage(
    {
      date: new Date(),
      type: "spare_part",
    },
    { trackDefaultValue: false },
  );

  const type = data?.type ?? "spare_part";
  // Subject dan Valid by wajib untuk surat unit baru dan sewa (AC3.2, AC3.5).
  const isLetterWithSubject = type === "new_unit" || type === "rental";

  const amount = useMemo(() => {
    return calculateArray(
      (data?.items ?? []).map((item) => ({
        amount: (item.quantity ?? 0) * (item.price ?? 0),
      })),
      "amount",
      "+",
    );
  }, [data?.items]);

  const handleTypeChange = (val) => {
    setData((prev) => {
      const next = { ...prev, type: val };
      // Blok yang lazim untuk jenis ini diusulkan otomatis (AC5.4), tapi hanya
      // bila dokumen belum punya blok supaya isian user tidak tertimpa.
      if (val && !(prev.sections?.length > 0)) {
        const suggested = templatesForType(sectionTemplates, val);
        if (suggested.length > 0) {
          next.sections = copyTemplatesToSections([], suggested);
        }
      }
      return next;
    });
  };

  return (
    <>
      <FormPageContent title={t("crm.quotation.detail")} value="detail">
        <div className="grid gap-x-4 gap-y-4 md:grid-cols-2">
          <FormInput
            name="type"
            label={t("crm.quotation.columns.type")}
            required={true}
          >
            <Select
              value={data?.type}
              onValueChange={handleTypeChange}
              placeholder={t("crm.quotation.columns.type.placeholder")}
              optionTrans="crm.quotation.columns.type.options"
              options={QUOTATION_TYPES}
              disabled={disabled}
            />
          </FormInput>
          <FormInput
            label={t("crm.quotation.columns.date")}
            required={true}
            name="date"
          >
            <DatetimePicker
              type="datetime"
              value={data?.date}
              onValueChange={(val) => setData("date", val)}
              disabled={disabled}
            />
          </FormInput>
          <FormInput
            label={t("crm.quotation.columns.customer")}
            required={true}
            name="customer"
          >
            <CustomerLinkModel
              placeholder={t("crm.quotation.columns.customer.placeholder")}
              value={data?.customer}
              onValueChange={(val) => setData("customer", val)}
              disabled={disabled}
            />
          </FormInput>
          <FormInput
            name="attn"
            label={t("crm.quotation.columns.attn")}
            required={true}
          >
            <Input
              value={data?.attn ?? ""}
              onChange={(e) => setData("attn", e.target.value)}
              disabled={disabled}
            />
          </FormInput>
          <FormInput
            name="subject"
            label={t("crm.quotation.columns.subject")}
            required={isLetterWithSubject}
          >
            <Input
              value={data?.subject ?? ""}
              onChange={(e) => setData("subject", e.target.value)}
              disabled={disabled}
            />
          </FormInput>
          <FormInput
            name="valid_until"
            label={t("crm.quotation.columns.valid_until")}
            required={isLetterWithSubject}
          >
            <DatetimePicker
              type="date"
              value={data?.valid_until}
              onValueChange={(val) => setData("valid_until", val)}
              disabled={disabled}
            />
          </FormInput>
          <FormInput
            name="issued_city"
            label={t("crm.quotation.columns.issued_city")}
          >
            <Input
              value={data?.issued_city ?? ""}
              onChange={(e) => setData("issued_city", e.target.value)}
              disabled={disabled}
            />
          </FormInput>
          <FormInput
            name="introduction"
            label={t("crm.quotation.columns.introduction")}
            required={true}
            className="col-span-full"
          >
            <Textarea
              rows={3}
              value={data?.introduction ?? ""}
              onChange={(e) => setData("introduction", e.target.value)}
              disabled={disabled}
            />
          </FormInput>
          <FormInput
            name="opportunity"
            label={t("crm.quotation.columns.opportunity")}
          >
            <OpportunityLinkModel
              placeholder={t("crm.quotation.columns.opportunity.placeholder")}
              value={data?.opportunity}
              onValueChange={(val) => setData("opportunity", val)}
              disabled={disabled || !!data?.referenceable}
            />
          </FormInput>
          {data?.referenceable && (
            <FormInput
              className="pointer-events-auto! col-span-full"
              label={t("crm.quotation.columns.reference_to")}
              readOnly
            >
              <LinkModel
                disabledAddButton
                model={data.referenceable_type}
                value={data.referenceable}
              />
            </FormInput>
          )}
        </div>
      </FormPageContent>

      <QuotationItems
        type={type}
        value={data?.items ?? []}
        onValueChange={(val) => setData("items", val)}
        readOnly={disabled}
      />

      <QuotationSections
        type={type}
        value={data?.sections ?? []}
        onValueChange={(val) => setData("sections", val)}
        readOnly={disabled}
      />

      <FormPageContent value="detail" title={null}>
        <FormInput
          readOnly
          label={t("crm.quotation.columns.amount")}
          className="md:col-start-2"
        >
          <NumberInput decimalScale={2} value={amount} readOnly />
        </FormInput>
      </FormPageContent>
    </>
  );
}
