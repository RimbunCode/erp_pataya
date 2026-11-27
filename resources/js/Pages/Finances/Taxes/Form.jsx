import { FormPageContent, useFormPage } from "@/Pages/Core/FormPage";

import NumberInput from "@/Components/NumberInput";
import FormInput from "@/Components/FormInput";
import { FormCheckbox } from "@/Components/ui/checkbox";
import { Input } from "@/Components/ui/input";
import React from "react";
import Select from "@/Components/Select";
import { usePage } from "@inertiajs/react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import RuleVersionsTab from "./RuleVersionsTab";

const CATEGORIES = [
  "unclassified",
  "ppn_standard",
  "ppn_luxury",
  "pph_21",
  "pph_22",
  "pph_23",
  "pph_4_2",
  "other",
];
const PPN_CATEGORIES = ["ppn_standard", "ppn_luxury"];
const BEHAVIORS = ["additive", "withholding"];

/**
 * Form master Pajak (Finance Fase 3, Requirement 1.3 dan 10.1): nama, tarif, klasifikasi (kategori, perilaku,
 * dapat dikreditkan), peringatan "belum diklasifikasi tetapi terpakai", dan tab Versi Aturan. Kombinasi
 * `withholding` dengan kategori PPN tidak dapat dipilih di klien (opsi disaring) dan ditolak server.
 * @returns {import("react").JSX.Element}
 */
export default function Form() {
  const { data, setData } = useFormPage();
  const { t } = useLaravelReactI18n();
  const usage = usePage().props.unclassifiedUsage;

  // Pajak baru belum membawa nilai default migration: tampilkan default yang sama dengan server.
  const category = data?.category ?? "unclassified";
  const behavior = data?.behavior ?? "additive";
  const isPpn = PPN_CATEGORIES.includes(category);
  const isWithholding = behavior === "withholding";
  const usedCount =
    (usage?.sales_invoices ?? 0) + (usage?.purchase_invoices ?? 0);
  const showUsageWarning =
    Boolean(data?.id) && category === "unclassified" && usedCount > 0;

  const changeCategory = (value) => {
    setData("category", value);
    // Pajak PPN tidak boleh dipotong: perilaku dikembalikan ke menambah total.
    if (PPN_CATEGORIES.includes(value) && behavior === "withholding") {
      setData("behavior", "additive");
    }
  };

  return (
    <>
      <FormPageContent title={null} value="detail">
        <div className="grid gap-x-3 gap-y-4">
          {showUsageWarning && (
            <p
              role="alert"
              className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
            >
              {t("finances.taxes.form.unclassified_used", {
                sales: usage?.sales_invoices ?? 0,
                purchase: usage?.purchase_invoices ?? 0,
              })}
            </p>
          )}
          <FormInput
            name="name"
            required={true}
            label={t("finances.taxes.columns.name")}
          >
            <Input
              value={data?.name ?? ""}
              onChange={(e) => setData("name", e.target.value)}
            />
          </FormInput>
          <FormInput
            name="rate"
            required={true}
            label={t("finances.taxes.columns.rate")}
          >
            <NumberInput
              className="text-left"
              value={data.rate}
              onValueChange={(value) => setData("rate", value)}
              suffix="%"
              decimalScale={2}
              min={0}
              max={100}
            />
          </FormInput>
          <FormInput
            name="category"
            label={t("finances.taxes.columns.category")}
          >
            <Select
              value={category}
              onValueChange={changeCategory}
              optionTrans="finances.taxes.columns.category.options"
              options={
                isWithholding
                  ? CATEGORIES.filter((item) => !PPN_CATEGORIES.includes(item))
                  : CATEGORIES
              }
            />
          </FormInput>
          <FormInput
            name="behavior"
            label={t("finances.taxes.columns.behavior")}
            description={
              isPpn ? t("finances.taxes.form.withholding_ppn_blocked") : null
            }
          >
            <Select
              value={behavior}
              onValueChange={(value) => setData("behavior", value)}
              optionTrans="finances.taxes.columns.behavior.options"
              options={isPpn ? ["additive"] : BEHAVIORS}
            />
          </FormInput>
          <FormCheckbox
            checked={data?.is_creditable ?? true}
            onCheckedChange={(value) => setData("is_creditable", value)}
            description={t("finances.taxes.form.is_creditable_description")}
          >
            {t("finances.taxes.columns.is_creditable")}
          </FormCheckbox>
        </div>
      </FormPageContent>
      {data?.id && <RuleVersionsTab taxId={data.id} taxRate={data.rate} />}
    </>
  );
}
