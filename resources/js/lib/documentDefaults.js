import { generateRandom } from "@/lib/utils";
import { useCallback } from "react";

const SOURCE_ROW_KEYS = [
  "referenceable_id",
  "purchase_order_item_id",
  "purchase_receipt_item_id",
  "sales_order_item_id",
  "return_against_item_id",
];

export function applyToNewLine(line, item, defaults, { warehouseField } = {}) {
  if (SOURCE_ROW_KEYS.some((key) => line?.[key]) || line?.referenceable?.id) {
    return line;
  }

  const nextLine = { ...line };
  if (!nextLine.tax && defaults?.tax) {
    nextLine.tax = defaults.tax;
    nextLine.tax_rate = nextLine.tax_rate ?? defaults.tax.rate ?? 0;
  }
  if (
    warehouseField &&
    item?.is_stock_item &&
    !nextLine[warehouseField] &&
    defaults?.warehouse
  ) {
    nextLine[warehouseField] = defaults.warehouse;
  }

  return nextLine;
}

export function paymentTemplateToSchedule(template, date) {
  return (template?.items ?? []).map((item) => {
    const dueDate = new Date(date);
    switch (item?.due_date_based_on) {
      case "days_after_invoice_date":
        dueDate.setDate(dueDate.getDate() + (item?.credit_period ?? 0));
        break;
      case "weeks_after_invoice_week":
        dueDate.setDate(dueDate.getDate() + (item?.credit_period ?? 0) * 7);
        break;
      case "months_after_invoice_month":
        dueDate.setMonth(dueDate.getMonth() + (item?.credit_period ?? 0));
        break;
    }

    return {
      id: generateRandom(5),
      due_date: dueDate,
      invoice_portion: item?.invoice_portion,
      discount_type: item?.discount_type,
      discount_date: item?.discount_type ? dueDate : undefined,
      discount: item?.discount,
      payment_method: item?.payment_method,
    };
  });
}

export function useDocumentDefaults(defaults) {
  const applyLineDefaults = useCallback(
    (line, item, options) => applyToNewLine(line, item, defaults, options),
    [defaults],
  );
  const applyPaymentTerm = useCallback(
    (currentSchedules, date) =>
      currentSchedules?.length
        ? currentSchedules
        : paymentTemplateToSchedule(defaults?.payment_term_template, date),
    [defaults],
  );

  return { applyToNewLine: applyLineDefaults, applyPaymentTerm };
}
